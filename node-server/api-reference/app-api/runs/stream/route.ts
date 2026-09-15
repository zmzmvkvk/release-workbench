import { NextResponse } from "next/server";
import { buildFixtureSteps, scenarioDefaultFixture, type FixtureId } from "@/lib/fixtures";
import {
  appendEvent,
  createRun,
  findByIdempotencyKey,
  getRun,
} from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(data: unknown, id?: string) {
  const idLine = id ? `id: ${id}\n` : "";
  return `${idLine}data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    scenarioId?: string;
    fixture?: FixtureId;
    idempotencyKey?: string;
    afterSeq?: number;
  };

  const scenarioId = body.scenarioId ?? "rw-004";
  const fixture = body.fixture ?? scenarioDefaultFixture(scenarioId);
  const idempotencyKey = body.idempotencyKey ?? `${scenarioId}-default-key`;

  if (fixture === "duplicate_blocked") {
    const fakeExisting = findByIdempotencyKey(idempotencyKey);
    const existingRunId = fakeExisting?.runId ?? "run_existing_demo";
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode(
            sse({
              id: "evt_dup",
              runId: existingRunId,
              seq: 0,
              ts: new Date().toISOString(),
              type: "run.duplicate_blocked",
              payload: { existingRunId },
            }),
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const runId = `run_${Date.now().toString(36)}`;
  const created = createRun({ runId, idempotencyKey, scenarioId, fixture });
  if ("duplicate" in created) {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode(
            sse({
              id: "evt_dup",
              runId: created.existing.runId,
              seq: created.existing.events.length,
              ts: new Date().toISOString(),
              type: "run.duplicate_blocked",
              payload: { existingRunId: created.existing.runId },
            }),
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const run = created;
  const steps = buildFixtureSteps(fixture, scenarioId);
  const afterSeq = typeof body.afterSeq === "number" ? body.afterSeq : -1;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const signal = run.abort.signal;

      const sleep = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          const onAbort = () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          };
          if (signal.aborted) {
            clearTimeout(t);
            reject(new Error("aborted"));
            return;
          }
          signal.addEventListener("abort", onAbort, { once: true });
        });

      try {
        for (const step of steps) {
          if (signal.aborted) break;
          if (step.kind === "waitCancel") {
            try {
              await sleep(step.delayMs);
            } catch {
              break;
            }
            continue;
          }
          try {
            await sleep(step.delayMs);
          } catch {
            break;
          }
          if (signal.aborted) break;
          const event = appendEvent(run, step.partial.type, step.partial.payload);
          if (event.seq <= afterSeq) continue;
          controller.enqueue(enc.encode(sse(event, event.id)));
        }
      } catch {
        // aborted mid-loop
      }

      if (run.cancelled) {
        const last = run.events[run.events.length - 1];
        if (last?.type === "run.cancelled") {
          // already appended by cancelRun — ensure client gets it if not sent
          if (last.seq > afterSeq) {
            controller.enqueue(enc.encode(sse(last, last.id)));
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Run-Id": run.runId,
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    runId: run.runId,
    scenarioId: run.scenarioId,
    cancelled: run.cancelled,
    events: run.events,
  });
}
