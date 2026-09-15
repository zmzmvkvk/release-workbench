import { NextResponse } from "next/server";
import { buildExecuteSteps } from "@/lib/execute-fixtures";
import { appendEvent, getRun } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(data: unknown, id?: string) {
  const idLine = id ? `id: ${id}\n` : "";
  return `${idLine}data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "gate_approve" | "gate_reject" | "gate_edit";
    reason?: string;
  };
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (run.cancelled) {
    return NextResponse.json({ error: "run cancelled" }, { status: 409 });
  }

  const action = body.action ?? "approve";

  if (action === "reject") {
    const event = appendEvent(run, "plan.rejected", {
      reason: body.reason ?? "user_rejected",
    });
    return NextResponse.json({ ok: true, event });
  }

  if (action === "gate_approve") {
    const e1 = appendEvent(run, "gate.approved", { by: "user" });
    const e2 = appendEvent(run, "run.completed", { summary: "released" });
    return NextResponse.json({ ok: true, events: [e1, e2] });
  }

  if (action === "gate_reject") {
    const e1 = appendEvent(run, "gate.rejected", {
      reason: body.reason ?? "user_rejected_at_gate",
    });
    const e2 = appendEvent(run, "eval.case_recorded", {
      caseId: run.scenarioId,
      outcome: "gate_rejected",
    });
    return NextResponse.json({ ok: true, events: [e1, e2] });
  }

  if (action === "gate_edit") {
    const event = appendEvent(run, "gate.edit_requested", {
      notes: body.reason ?? "needs edits",
    });
    return NextResponse.json({ ok: true, event });
  }

  // approve → stream execute phase
  const approveEvent = appendEvent(run, "plan.approved", { by: "user" });
  const steps = buildExecuteSteps(run.scenarioId);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(sse(approveEvent, approveEvent.id)));

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
          controller.enqueue(enc.encode(sse(event, event.id)));
        }
      } catch {
        // aborted
      }

      if (run.cancelled) {
        const last = run.events[run.events.length - 1];
        if (last?.type === "run.cancelled") {
          controller.enqueue(enc.encode(sse(last, last.id)));
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
