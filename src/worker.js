/**
 * Cloudflare Worker: static assets + HTTP SSE mock for Release Workbench.
 * Client falls back to in-browser mock if this path is unavailable.
 */

const runs = new Map();
/** @type {Map<string, string>} idempotencyKey -> runId */
const idempotency = new Map();

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
  if (fixture === "max_steps_exceeded") {
    return [
      start,
      delta("도구 루프…"),
      {
        delayMs: 200,
        type: "run.failed",
        payload: {
          code: "MAX_STEPS",
          message: "exceeded max tool steps (8)",
          steps: 8,
        },
      },
    ];
  }
  if (fixture === "unsafe_html_isolated") {
    return [
      start,
      delta("미리보기 격리 검사…"),
      {
        delayMs: 250,
        type: "preview.ready",
        payload: {
          desktopHtml:
            '<div>safe</div><script>alert(1)</script><img src=x onerror=alert(1)>',
          mobileHtml: "<div>safe</div>",
          sanitized: true,
          blocked: ["script", "onerror"],
        },
      },
      {
        delayMs: 100,
        type: "plan.proposed",
        payload: { steps: ["DOMPurify", "sandboxed iframe"] },
      },
    ];
  }
  if (fixture === "network_resume") {
    return [
      start,
      delta("스트리밍…"),
      {
        delayMs: 200,
        type: "stream.interrupted",
        payload: { reason: "network_drop", lastSeq: 1 },
      },
      {
        delayMs: 400,
        type: "stream.resumed",
        payload: { fromSeq: 2 },
      },
      delta("재개 후 구조화…", 200),
      {
        delayMs: 250,
        type: "requirements.ready",
        payload: {
          requirements: [
            {
              id: "r1",
              text: "재개된 요구",
              priority: "must",
              citations: [{ quote: "재개", sourceIndex: 0, start: 0, end: 2 }],
            },
          ],
          conflicts: [],
        },
      },
      {
        delayMs: 100,
        type: "plan.proposed",
        payload: { steps: ["재개 검증"] },
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

function executeSteps(scenarioId, fixture) {
  if (fixture === "tool_fail_retry") {
    return [
      {
        delayMs: 100,
        type: "tool.started",
        payload: { callId: "t1", name: "apply_code_patch", args: { scenarioId } },
      },
      {
        delayMs: 200,
        type: "tool.failed",
        payload: { callId: "t1", error: "sandbox_timeout", retryable: true },
      },
      {
        delayMs: 150,
        type: "tool.started",
        payload: {
          callId: "t1r",
          name: "apply_code_patch",
          args: { scenarioId, attempt: 2 },
        },
      },
      {
        delayMs: 250,
        type: "tool.finished",
        payload: { callId: "t1r", result: { filesChanged: 2, retried: true } },
      },
      {
        delayMs: 100,
        type: "diff.updated",
        payload: {
          files: [
            {
              path: "src/components/CourseCardGrid.tsx",
              additions: 8,
              deletions: 1,
              patch: "+/* retry succeeded */",
            },
          ],
        },
      },
      {
        delayMs: 100,
        type: "preview.ready",
        payload: {
          desktopHtml: "<div>retry ok</div>",
          mobileHtml: "<div>retry ok</div>",
        },
      },
      {
        delayMs: 100,
        type: "qa.finished",
        payload: {
          report: {
            passed: true,
            suites: [{ name: "axe", passed: true, detail: "0 after retry" }],
          },
        },
      },
      { delayMs: 50, type: "gate.pending", payload: {} },
    ];
  }
  if (fixture === "qa_axe_fail") {
    return [
      {
        delayMs: 100,
        type: "tool.started",
        payload: { callId: "t1", name: "apply_code_patch", args: { scenarioId } },
      },
      {
        delayMs: 150,
        type: "tool.finished",
        payload: { callId: "t1", result: { filesChanged: 1 } },
      },
      {
        delayMs: 100,
        type: "diff.updated",
        payload: {
          files: [
            {
              path: "src/Banner.tsx",
              additions: 5,
              deletions: 0,
              patch: '+<img src="/x.png" />',
            },
          ],
        },
      },
      {
        delayMs: 100,
        type: "preview.ready",
        payload: {
          desktopHtml: '<img src="/x.png" />',
          mobileHtml: '<img src="/x.png" />',
        },
      },
      {
        delayMs: 100,
        type: "qa.started",
        payload: { suites: ["axe"] },
      },
      {
        delayMs: 200,
        type: "qa.finished",
        payload: {
          report: {
            passed: false,
            suites: [
              {
                name: "axe",
                passed: false,
                detail: "image-alt: img missing alt",
              },
            ],
          },
        },
      },
      { delayMs: 50, type: "gate.pending", payload: {} },
    ];
  }
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

async function persistRun(env, run) {
  if (!env.WORKBENCH_IDEMPOTENCY) return;
  try {
    await env.WORKBENCH_IDEMPOTENCY.put(
      `run:${run.runId}`,
      JSON.stringify({
        runId: run.runId,
        scenarioId: run.scenarioId,
        fixture: run.fixture,
        mode: run.mode,
        idempotencyKey: run.idempotencyKey,
      }),
      { expirationTtl: 3600 },
    );
  } catch {
    /* best-effort */
  }
}

async function loadRun(env, runId) {
  let run = runs.get(runId);
  if (run) return run;
  if (!env.WORKBENCH_IDEMPOTENCY) return null;
  try {
    const raw = await env.WORKBENCH_IDEMPOTENCY.get(`run:${runId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ac = new AbortController();
    run = {
      runId,
      scenarioId: data.scenarioId,
      fixture: data.fixture,
      mode: data.mode ?? "mock",
      idempotencyKey: data.idempotencyKey,
      cancelled: false,
      events: [],
      abort: ac,
    };
    runs.set(runId, run);
    return run;
  } catch {
    return null;
  }
}

/** Pause after tool.started until continue(args_*) / KV signal / soft timeout. */
async function waitArgsGate(run, signal, env, softTimeoutMs = 12_000) {
  if (run.cancelled || signal.aborted) return;
  const key = `args:${run.runId}`;
  if (env?.WORKBENCH_IDEMPOTENCY) {
    try {
      await env.WORKBENCH_IDEMPOTENCY.put(key, "waiting", { expirationTtl: 60 });
    } catch {
      /* memory path only */
    }
  }

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      signal.removeEventListener("abort", onAbort);
      run.resolveArgsGate = null;
      resolve();
    };
    const timer = setTimeout(finish, softTimeoutMs);
    const onAbort = () => finish();
    signal.addEventListener("abort", onAbort);
    run.resolveArgsGate = () => finish();

    const poll = setInterval(async () => {
      if (!env?.WORKBENCH_IDEMPOTENCY) return;
      try {
        const v = await env.WORKBENCH_IDEMPOTENCY.get(key);
        if (!v || v === "waiting") return;
        if (v.startsWith("edit:")) {
          try {
            run.pendingArgsEdit = JSON.parse(v.slice(5));
          } catch {
            run.pendingArgsEdit = v.slice(5);
          }
        }
        try {
          await env.WORKBENCH_IDEMPOTENCY.delete(key);
        } catch {
          /* ignore */
        }
        finish();
      } catch {
        /* ignore poll errors */
      }
    }, 200);
  });
}

async function play(run, steps, controller, signal, env) {
  const enc = new TextEncoder();
  let argsGateUsed = false;
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

    if (step.type === "tool.started" && !argsGateUsed) {
      argsGateUsed = true;
      await waitArgsGate(run, signal, env);
      if (run.cancelled || signal.aborted) break;
      if (run.pendingArgsEdit) {
        const edited = append(run, "tool.args_edited", {
          callId: step.payload?.callId ?? "t1",
          name: step.payload?.name,
          args: run.pendingArgsEdit,
        });
        controller.enqueue(enc.encode(sse(edited, edited.id)));
        run.pendingArgsEdit = null;
      }
    }
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

async function playWorkersAiStructuring(run, env, controller, signal, sourceText) {
  const enc = new TextEncoder();
  const t0 = Date.now();
  let ttftMs = null;
  const push = (type, payload) => {
    const event = append(run, type, payload);
    controller.enqueue(enc.encode(sse(event, event.id)));
    return event;
  };

  push("run.started", {
    scenarioId: run.scenarioId,
    mode: "workers-ai",
    model: "@cf/meta/llama-3.2-3b-instruct",
    idempotencyKey: run.idempotencyKey,
  });
  push("stream.delta", {
    channel: "structuring",
    text: "Workers AI로 요구사항 구조화…",
  });

  const prompt = `Extract at most 2 requirements from the SOURCE text only. JSON only, no markdown.
Rules:
- citations.quote MUST be a contiguous substring copied from SOURCE (not invented).
- priority is "must" or "should".
- If two SOURCE lines contradict, put a conflicts entry.
Schema:
{"requirements":[{"id":"r1","text":"...","priority":"must","citations":[{"quote":"exact from source","sourceIndex":0,"start":0,"end":5}]}],"conflicts":[]}
SOURCE:
${(sourceText || "card grid desktop 3 mobile 1 CTA detail").slice(0, 800)}`;

  let raw = "";
  let usageTokens = null;
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a JSON API. Output one minified JSON object only. Quotes in citations must be copied from SOURCE. Stop after the closing brace.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 350,
      temperature: 0.1,
    });
    ttftMs = Date.now() - t0;
    const usage = result?.usage ?? result?.result?.usage;
    if (usage && typeof usage.total_tokens === "number") {
      usageTokens = usage.total_tokens;
    } else if (usage && typeof usage.prompt_tokens === "number") {
      usageTokens =
        (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
    }
    raw =
      typeof result === "string"
        ? result
        : typeof result?.response === "string"
          ? result.response
          : JSON.stringify(result?.response ?? result);
  } catch (err) {
    push("run.failed", {
      code: "WORKERS_AI",
      message: String(err?.message ?? err),
    });
    controller.close();
    return;
  }

  if (signal.aborted || run.cancelled) {
    push("run.cancelled", { reason: "user_cancelled" });
    controller.close();
    return;
  }

  push("stream.delta", {
    channel: "structuring",
    text: raw.slice(0, 280),
  });

  function tryParse(text) {
    return JSON.parse(text);
  }

  function repairJson(text) {
    let repaired = text.trim();
    const start = repaired.indexOf("{");
    if (start >= 0) repaired = repaired.slice(start);
    repaired = repaired.replace(/```json|```/g, "");
    repaired = repaired.replace(/,\s*$/, "");
    repaired = repaired.replace(/:\s*"[^"]*$/, ':""');
    repaired = repaired.replace(/:\s*[^,\]}]*$/, ":null");
    while (
      (repaired.match(/\[/g) || []).length >
      (repaired.match(/\]/g) || []).length
    ) {
      repaired += "]";
    }
    while (
      (repaired.match(/\{/g) || []).length >
      (repaired.match(/\}/g) || []).length
    ) {
      repaired += "}";
    }
    return repaired;
  }

  let parsed;
  let usedFallback = false;
  try {
    parsed = tryParse(raw.trim());
  } catch {
    try {
      parsed = tryParse(repairJson(raw));
      push("stream.delta", {
        channel: "structuring",
        text: "[repaired truncated JSON]",
      });
    } catch {
      push("requirements.invalid", {
        issues: [{ path: "$", message: "model output was not JSON" }],
        rawPreview: raw.slice(0, 400),
      });
      push("stream.delta", {
        channel: "structuring",
        text: "스키마 실패 → 휴리스틱 폴백(HITL 검토 필요)",
      });
      usedFallback = true;
      const src = (sourceText || "desktop 3 columns").slice(0, 120);
      parsed = {
        requirements: [
          {
            id: "r1",
            text: src,
            priority: "must",
            citations: [
              {
                quote: src.slice(0, Math.min(24, src.length)),
                sourceIndex: 0,
                start: 0,
                end: Math.min(24, src.length),
              },
            ],
          },
        ],
        conflicts: [],
        fallback: "heuristic_after_schema_fail",
      };
    }
  }

  if (!Array.isArray(parsed.requirements)) {
    push("requirements.invalid", {
      issues: [{ path: "requirements", message: "expected array" }],
    });
    push("run.failed", { code: "SCHEMA", message: "missing requirements array" });
    controller.close();
    return;
  }

  push("requirements.ready", {
    requirements: parsed.requirements.map((r) => sanitizeRequirement(r, sourceText)),
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    fallback: usedFallback || parsed.fallback || null,
  });
  push("plan.proposed", {
    steps: ["코드 패치", "미리보기", "QA"],
  });
  const totalMs = Date.now() - t0;
  push("trace.span", {
    name: "workers_ai_structuring",
    start: 0,
    end: totalMs,
    attrs: { ttftMs, usedFallback },
  });
  push("metrics.sample", {
    ttftMs,
    totalMs,
    tokens: usageTokens,
    costUsd: null,
    provider: "workers-ai",
    model: "@cf/meta/llama-3.2-3b-instruct",
    promptVersion: "workers-ai-struct-v3",
  });
  await persistRun(env, run);
  controller.close();
}

/** Force citation quotes to be substrings of source when model invents them. */
function sanitizeRequirement(req, sourceText) {
  const src = sourceText || "";
  const text = String(req?.text ?? "").slice(0, 200);
  let citations = Array.isArray(req?.citations) ? req.citations : [];
  citations = citations.map((c) => {
    const quote = String(c?.quote ?? "");
    if (quote && src.includes(quote)) {
      const start = src.indexOf(quote);
      return { ...c, quote, sourceIndex: 0, start, end: start + quote.length };
    }
    const fallbackQuote = src.slice(0, Math.min(24, src.length));
    return {
      quote: fallbackQuote,
      sourceIndex: 0,
      start: 0,
      end: fallbackQuote.length,
      repaired: true,
    };
  });
  if (citations.length === 0 && src) {
    const fallbackQuote = src.slice(0, Math.min(24, src.length));
    citations = [
      {
        quote: fallbackQuote,
        sourceIndex: 0,
        start: 0,
        end: fallbackQuote.length,
        repaired: true,
      },
    ];
  }
  return {
    id: String(req?.id ?? "r1"),
    text: text || src.slice(0, 80),
    priority: req?.priority === "should" ? "should" : "must",
    citations,
  };
}

export default {
  async fetch(request, env, ctx) {
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
      const mode = body.mode === "workers-ai" ? "workers-ai" : "mock";

      if (fixture === "duplicate_blocked") {
        const existing = "run_existing_demo";
        const event = {
          id: `evt_dup_${Date.now().toString(36)}`,
          runId: existing,
          seq: 0,
          ts: new Date().toISOString(),
          type: "run.duplicate_blocked",
          payload: { existingRunId: existing, idempotencyKey: key },
        };
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(sse(event, event.id)));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Run-Id": existing,
          },
        });
      }

      let existingFromStore = idempotency.get(key) ?? null;
      if (!existingFromStore && env.WORKBENCH_IDEMPOTENCY) {
        try {
          existingFromStore = await env.WORKBENCH_IDEMPOTENCY.get(`idem:${key}`);
        } catch {
          existingFromStore = null;
        }
      }
      if (existingFromStore) {
        const event = {
          id: `evt_dup_${Date.now().toString(36)}`,
          runId: existingFromStore,
          seq: 0,
          ts: new Date().toISOString(),
          type: "run.duplicate_blocked",
          payload: {
            existingRunId: existingFromStore,
            idempotencyKey: key,
            store: "kv+memory",
          },
        };
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(sse(event, event.id)));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Run-Id": existingFromStore,
          },
        });
      }

      const runId = `run_${Date.now().toString(36)}`;
      const ac = new AbortController();
      const run = {
        runId,
        scenarioId,
        fixture,
        mode,
        idempotencyKey: key,
        cancelled: false,
        events: [],
        abort: ac,
      };
      runs.set(runId, run);
      idempotency.set(key, runId);
      if (env.WORKBENCH_IDEMPOTENCY) {
        try {
          await env.WORKBENCH_IDEMPOTENCY.put(`idem:${key}`, runId, {
            expirationTtl: 3600,
          });
        } catch {
          /* memory still holds */
        }
      }
      // Persist immediately so continue works even if the SSE client disconnects
      // before the stream callback finishes.
      ctx.waitUntil(persistRun(env, run));

      const stream = new ReadableStream({
        async start(controller) {
          request.signal.addEventListener("abort", () => {
            // Client closed the structuring SSE — do NOT mark run.cancelled
            // (HITL continue / args gate still need this run across isolates).
            ac.abort();
          });
          try {
            if (mode === "workers-ai" && env.AI) {
              await playWorkersAiStructuring(
                run,
                env,
                controller,
                ac.signal,
                body.sourceText,
              );
            } else {
              await play(
                run,
                structuringSteps(fixture, scenarioId, key),
                controller,
                ac.signal,
                env,
              );
            }
            ctx.waitUntil(persistRun(env, run));
          } catch (err) {
            const enc = new TextEncoder();
            const event = append(run, "run.failed", {
              code: "STREAM",
              message: String(err?.message ?? err),
            });
            try {
              controller.enqueue(enc.encode(sse(event, event.id)));
              controller.close();
            } catch {
              /* already closed */
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Run-Id": runId,
          "X-Workbench-Mode": mode,
        },
      });
    }

    if (
      url.pathname.match(/^\/workbench\/api\/runs\/[^/]+\/continue$/) &&
      request.method === "POST"
    ) {
      const runId = url.pathname.split("/")[4];
      const body = await request.json().catch(() => ({}));

      // Args HITL can land on another isolate — signal via KV even without in-memory run
      if (body.action === "args_continue" || body.action === "args_edit") {
        if (env.WORKBENCH_IDEMPOTENCY) {
          try {
            const val =
              body.action === "args_edit" && body.args != null
                ? `edit:${JSON.stringify(body.args)}`
                : "continue";
            await env.WORKBENCH_IDEMPOTENCY.put(`args:${runId}`, val, {
              expirationTtl: 60,
            });
          } catch {
            /* fall through to memory */
          }
        }
        const mem = runs.get(runId);
        if (body.action === "args_edit" && body.args != null && mem) {
          mem.pendingArgsEdit = body.args;
        }
        if (typeof mem?.resolveArgsGate === "function") {
          mem.resolveArgsGate();
        }
        return Response.json({
          ok: true,
          released: true,
          action: body.action,
          via: mem?.resolveArgsGate ? "memory+kv" : "kv",
        });
      }

      const run = await loadRun(env, runId);
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
      const execAbort = new AbortController();
      run.abort = execAbort;
      run.cancelled = false;
      const stream = new ReadableStream({
        async start(controller) {
          request.signal.addEventListener("abort", () => {
            // Closing execute SSE cancels only this execute phase
            execAbort.abort();
          });
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(sse(approve, approve.id)));
          await play(
            run,
            executeSteps(run.scenarioId ?? "rw-004", run.fixture),
            controller,
            execAbort.signal,
            env,
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
      const run = (await loadRun(env, runId)) ?? runs.get(runId);
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
