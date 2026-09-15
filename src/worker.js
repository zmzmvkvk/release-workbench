/**
 * Cloudflare Worker: static assets + HTTP SSE mock for Release Workbench.
 * Client falls back to in-browser mock if this path is unavailable.
 */

const runs = new Map();

function sse(data, id) {
  const idLine = id ? `id: ${id}\n` : "";
  return `${idLine}data: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    if (signal?.aborted) {
      clearTimeout(t);
      reject(new Error("aborted"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function append(run, type, payload) {
  const event = {
    id: `evt_${run.runId}_${run.events.length}`,
    runId: run.runId,
    seq: run.events.length,
    ts: new Date().toISOString(),
    type,
    payload,
  };
  run.events.push(event);
  return event;
}

/** Minimal happy + failure fixtures for live SSE evidence */
function structuringSteps(fixture, scenarioId, key) {
  const start = {
    delayMs: 0,
    type: "run.started",
    payload: { scenarioId, mode: "mock", idempotencyKey: key },
  };
  const delta = (text, delayMs = 200) => ({
    delayMs,
    type: "stream.delta",
    payload: { channel: "structuring", text },
  });

  if (fixture === "duplicate_blocked") {
    return [
      {
        delayMs: 0,
        type: "run.duplicate_blocked",
        payload: { existingRunId: "run_existing_demo" },
      },
    ];
  }
  if (fixture === "invalid_requirements_json") {
    return [
      start,
      delta("구조화 중…"),
      {
        delayMs: 300,
        type: "requirements.invalid",
        payload: { issues: [{ path: "priority", message: "expected enum" }] },
      },
      {
        delayMs: 50,
        type: "run.failed",
        payload: { code: "SCHEMA", message: "structured output failed validation" },
      },
    ];
  }
  if (fixture === "citation_missing_block") {
    return [
      start,
      delta("원문 근거 검색…"),
      { delayMs: 200, type: "citation.missing", payload: { reqId: "r1" } },
      {
        delayMs: 200,
        type: "requirements.ready",
        payload: {
          requirements: [{ id: "r1", text: "요즘 느낌으로", priority: "must", citations: [] }],
          conflicts: [],
        },
      },
    ];
  }
  if (fixture === "conflict_discount_copy") {
    return [
      start,
      delta("충돌 탐지…"),
      {
        delayMs: 300,
        type: "requirements.ready",
        payload: {
          requirements: [
            {
              id: "r1",
              text: "할인 표기",
              priority: "must",
              citations: [{ quote: "10% 할인", sourceIndex: 0, start: 0, end: 5 }],
            },
            {
              id: "r2",
              text: "할인율 금지",
              priority: "must",
              citations: [{ quote: "할인율 표기 금지", sourceIndex: 1, start: 0, end: 8 }],
            },
          ],
          conflicts: [
            { id: "c1", kind: "contradiction", requirementIds: ["r1", "r2"], note: "할인 충돌" },
          ],
        },
      },
      {
        delayMs: 100,
        type: "plan.proposed",
        payload: { steps: ["충돌 해소", "카피 패치"] },
      },
    ];
  }
  // default happy
  return [
    start,
    delta("원문에서 요구사항 추출…"),
    delta("카드 그리드 구조화…", 300),
    {
      delayMs: 350,
      type: "requirements.ready",
      payload: {
        requirements: [
          {
            id: "r1",
            text: "데스크톱 3열 / 모바일 1열",
            priority: "must",
            citations: [{ quote: "3열", sourceIndex: 0, start: 0, end: 2 }],
          },
          {
            id: "r2",
            text: "CTA 상세보기",
            priority: "must",
            citations: [{ quote: "상세보기", sourceIndex: 0, start: 0, end: 4 }],
          },
        ],
        conflicts: [],
      },
    },
    {
      delayMs: 150,
      type: "plan.proposed",
      payload: { steps: ["레이아웃 패치", "미리보기", "axe"] },
    },
    {
      delayMs: 50,
      type: "metrics.sample",
      payload: { ttftMs: 180, tokens: 420, costUsd: 0 },
    },
  ];
}

function executeSteps(scenarioId) {
  return [
    {
      delayMs: 100,
      type: "tool.started",
      payload: { callId: "t1", name: "apply_code_patch", args: { scenarioId } },
    },
    {
      delayMs: 250,
      type: "tool.finished",
      payload: { callId: "t1", result: { filesChanged: 2 } },
    },
    {
      delayMs: 150,
      type: "diff.updated",
      payload: {
        files: [
          {
            path: "src/components/CourseCardGrid.tsx",
            additions: 20,
            deletions: 2,
            patch: "+export function CourseCardGrid() { /* … */ }",
          },
        ],
      },
    },
    {
      delayMs: 150,
      type: "preview.ready",
      payload: {
        desktopHtml:
          '<div style="padding:12px;font-family:system-ui;color:#eee"><h2>과정</h2><button>상세보기</button></div>',
        mobileHtml:
          '<div style="padding:12px;font-family:system-ui;color:#eee"><h2>과정</h2><button>상세보기</button></div>',
      },
    },
    {
      delayMs: 100,
      type: "qa.started",
      payload: { suites: ["playwright", "axe"] },
    },
    {
      delayMs: 200,
      type: "qa.finished",
      payload: {
        report: {
          passed: true,
          suites: [
            { name: "axe", passed: true, detail: "0 violations" },
            { name: "playwright", passed: true, detail: "CTA visible" },
          ],
        },
      },
    },
    {
      delayMs: 50,
      type: "trace.span",
      payload: { name: "execute", start: 0, end: 900, attrs: {} },
    },
    { delayMs: 50, type: "gate.pending", payload: {} },
  ];
}

async function play(run, steps, controller, signal) {
  const enc = new TextEncoder();
  for (const step of steps) {
    if (signal.aborted || run.cancelled) break;
    try {
      await sleep(step.delayMs, signal);
    } catch {
      break;
    }
    if (run.cancelled || signal.aborted) break;
    const event = append(run, step.type, step.payload);
    controller.enqueue(enc.encode(sse(event, event.id)));
  }
  if (run.cancelled) {
    const last = run.events[run.events.length - 1];
    if (last?.type !== "run.cancelled") {
      const event = append(run, "run.cancelled", { reason: "user_cancelled" });
      controller.enqueue(enc.encode(sse(event, event.id)));
    } else {
      controller.enqueue(enc.encode(sse(last, last.id)));
    }
  }
  controller.close();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- SSE mock API (HTTP streaming evidence) ---
    if (
      url.pathname === "/workbench/api/runs/stream" &&
      request.method === "POST"
    ) {
      const body = await request.json().catch(() => ({}));
      const scenarioId = body.scenarioId ?? "rw-004";
      const fixture = body.fixture ?? "happy_card_grid";
      const key = body.idempotencyKey ?? `${scenarioId}-key`;
      const runId = `run_${Date.now().toString(36)}`;
      const ac = new AbortController();
      const run = {
        runId,
        scenarioId,
        cancelled: false,
        events: [],
        abort: ac,
      };
      runs.set(runId, run);

      const stream = new ReadableStream({
        start(controller) {
          request.signal.addEventListener("abort", () => {
            run.cancelled = true;
            ac.abort();
          });
          play(
            run,
            structuringSteps(fixture, scenarioId, key),
            controller,
            ac.signal,
          );
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Run-Id": runId,
        },
      });
    }

    if (
      url.pathname.match(/^\/workbench\/api\/runs\/[^/]+\/continue$/) &&
      request.method === "POST"
    ) {
      const runId = url.pathname.split("/")[4];
      const run = runs.get(runId);
      const body = await request.json().catch(() => ({}));
      if (!run) {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      if (body.action === "reject") {
        const event = append(run, "plan.rejected", {
          reason: body.reason ?? "user_rejected",
        });
        return Response.json({ ok: true, event });
      }
      if (body.action === "gate_approve") {
        const e1 = append(run, "gate.approved", { by: "user" });
        const e2 = append(run, "run.completed", { summary: "released" });
        return Response.json({ ok: true, events: [e1, e2] });
      }
      if (body.action === "gate_reject") {
        const e1 = append(run, "gate.rejected", {
          reason: body.reason ?? "rejected",
        });
        return Response.json({ ok: true, events: [e1] });
      }

      const approve = append(run, "plan.approved", { by: "user" });
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(sse(approve, approve.id)));
          await play(
            run,
            executeSteps(run.scenarioId ?? "rw-004"),
            controller,
            run.abort.signal,
          );
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Run-Id": runId,
        },
      });
    }

    if (
      url.pathname.match(/^\/workbench\/api\/runs\/[^/]+\/cancel$/) &&
      request.method === "POST"
    ) {
      const runId = url.pathname.split("/")[4];
      const run = runs.get(runId);
      if (!run) return Response.json({ error: "not found" }, { status: 404 });
      run.cancelled = true;
      run.abort.abort();
      const event = append(run, "run.cancelled", { reason: "user_cancelled" });
      return Response.json({ ok: true, event });
    }

    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/workbench", url.origin), 302);
    }

    if (url.pathname.startsWith("/workbench")) {
      const rest = url.pathname.slice("/workbench".length);
      url.pathname = rest === "" ? "/" : rest;
    }

    return env.ASSETS.fetch(url);
  },
};
