import type { WorkbenchEvent } from "./protocol";

export async function readSseStream(
  res: Response,
  onEvent: (event: WorkbenchEvent) => void,
  signal?: AbortSignal,
) {
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(6)) as WorkbenchEvent);
      } catch {
        // ignore
      }
    }
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export type HttpStructuringResult =
  | { kind: "ok" }
  | { kind: "unavailable" }
  | {
      kind: "recovered";
      runId: string;
      eventCount: number;
      eventTypes: string[];
      source?: string;
    }
  | {
      kind: "rate_limited";
      retryAfterSec: number;
      activeStreams?: number;
      retried: boolean;
    };

export function parseRetryAfterSec(
  res: Response,
  body?: { retryAfter?: unknown },
) {
  const raw = res.headers.get("Retry-After");
  if (raw != null && raw !== "") {
    const header = Number(raw);
    if (Number.isFinite(header) && header > 0) return Math.min(30, header);
  }
  if (typeof body?.retryAfter === "number" && body.retryAfter > 0) {
    return Math.min(30, body.retryAfter);
  }
  return 2;
}

async function postStreamOnce(
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  return fetch("/workbench/api/runs/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export type RunSnapshot = {
  runId: string;
  scenarioId?: string;
  fixture?: string;
  mode?: string;
  eventCount: number;
  eventTypes?: string[];
  toolNames?: string[];
  source?: string;
  error?: string;
};

/** GET /workbench/api/runs/:id — memory or KV snapshot after SSE drop. */
export async function fetchRunSnapshot(
  runId: string,
  signal?: AbortSignal,
): Promise<RunSnapshot | null> {
  try {
    const res = await fetch(`/workbench/api/runs/${encodeURIComponent(runId)}`, {
      signal: signal ?? AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RunSnapshot & { error?: string };
    if (data.error || !data.runId) return null;
    return data;
  } catch {
    return null;
  }
}

/** Prefer Worker HTTP SSE; returns structured result (429 retry once). */
export async function tryHttpStructuring(opts: {
  scenarioId: string;
  fixture: string;
  idempotencyKey: string;
  mode?: "mock" | "workers-ai";
  sourceText?: string;
  signal: AbortSignal;
  onEvent: (e: WorkbenchEvent) => void;
  onRunId: (id: string) => void;
  onRateLimited?: (info: { retryAfterSec: number; attempt: number }) => void;
  /** Called when the SSE body drops mid-stream and a run snapshot is recovered. */
  onStreamInterrupted?: (snap: RunSnapshot) => void;
}): Promise<HttpStructuringResult> {
  const payload = {
    scenarioId: opts.scenarioId,
    fixture: opts.fixture,
    idempotencyKey: opts.idempotencyKey,
    mode: opts.mode ?? "mock",
    sourceText: opts.sourceText,
  };

  let runId: string | null = null;

  try {
    let res = await postStreamOnce(payload, opts.signal);
    let firstActive: number | undefined;

    if (res.status === 429) {
      let body: { activeStreams?: number; retryAfter?: number } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        /* empty */
      }
      firstActive = body.activeStreams;
      const retryAfterSec = parseRetryAfterSec(res, body);
      opts.onRateLimited?.({ retryAfterSec, attempt: 1 });
      await sleep(retryAfterSec * 1000, opts.signal);
      res = await postStreamOnce(
        { ...payload, idempotencyKey: `${opts.idempotencyKey}-retry` },
        opts.signal,
      );
      if (res.status === 429) {
        let body2: { activeStreams?: number; retryAfter?: number } = {};
        try {
          body2 = (await res.json()) as typeof body2;
        } catch {
          /* empty */
        }
        return {
          kind: "rate_limited",
          retryAfterSec: parseRetryAfterSec(res, body2),
          activeStreams: body2.activeStreams ?? firstActive,
          retried: true,
        };
      }
    }

    if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
      return { kind: "unavailable" };
    }
    const id = res.headers.get("X-Run-Id");
    if (id) {
      runId = id;
      opts.onRunId(id);
    }
    await readSseStream(res, opts.onEvent, opts.signal);
    return { kind: "ok" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    if (runId) {
      const snap = await fetchRunSnapshot(runId, opts.signal);
      if (snap && snap.eventCount > 0) {
        opts.onStreamInterrupted?.(snap);
        return {
          kind: "recovered",
          runId,
          eventCount: snap.eventCount,
          eventTypes: snap.eventTypes ?? [],
          source: snap.source,
        };
      }
    }
    return { kind: "unavailable" };
  }
}

export async function tryHttpContinue(opts: {
  runId: string;
  action: string;
  args?: unknown;
  reason?: string;
  signal?: AbortSignal;
  onEvent: (e: WorkbenchEvent) => void;
}): Promise<"sse" | "json" | "none"> {
  try {
    const timeout = AbortSignal.timeout(4_000);
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, timeout])
      : timeout;
    const res = await fetch(`/workbench/api/runs/${opts.runId}/continue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: opts.action,
        ...(opts.args !== undefined ? { args: opts.args } : {}),
        ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      }),
      signal,
    });
    if (!res.ok) return "none";
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/event-stream")) {
      await readSseStream(res, opts.onEvent, signal);
      return "sse";
    }
    if (!ct.includes("application/json")) return "none";
    const data = (await res.json()) as {
      event?: WorkbenchEvent;
      events?: WorkbenchEvent[];
      ok?: boolean;
      released?: boolean;
    };
    if (data.released || data.ok === true) {
      if (data.event) opts.onEvent(data.event);
      if (data.events) data.events.forEach(opts.onEvent);
      return "json";
    }
    if (data.event) opts.onEvent(data.event);
    if (data.events?.length) {
      data.events.forEach(opts.onEvent);
      return "json";
    }
    return "none";
  } catch {
    return "none";
  }
}

export async function tryHttpCancel(runId: string): Promise<WorkbenchEvent | null> {
  try {
    const res = await fetch(`/workbench/api/runs/${runId}/cancel`, {
      method: "POST",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { event?: WorkbenchEvent };
    return data.event ?? null;
  } catch {
    return null;
  }
}

export type WorkerHealth = {
  ok: boolean;
  sse?: boolean;
  kv?: boolean;
  ai?: boolean;
  maxActiveStreams?: number;
};

export async function probeWorkerHealth(
  signal?: AbortSignal,
): Promise<WorkerHealth | null> {
  try {
    const res = await fetch("/workbench/api/health", {
      signal: signal ?? AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as WorkerHealth;
  } catch {
    return null;
  }
}
