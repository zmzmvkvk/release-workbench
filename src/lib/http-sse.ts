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

/** Prefer Worker HTTP SSE; returns null if unavailable (use client mock). */
export async function tryHttpStructuring(opts: {
  scenarioId: string;
  fixture: string;
  idempotencyKey: string;
  mode?: "mock" | "workers-ai";
  sourceText?: string;
  signal: AbortSignal;
  onEvent: (e: WorkbenchEvent) => void;
  onRunId: (id: string) => void;
}): Promise<boolean> {
  try {
    const res = await fetch("/workbench/api/runs/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: opts.scenarioId,
        fixture: opts.fixture,
        idempotencyKey: opts.idempotencyKey,
        mode: opts.mode ?? "mock",
        sourceText: opts.sourceText,
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
      return false;
    }
    const id = res.headers.get("X-Run-Id");
    if (id) opts.onRunId(id);
    await readSseStream(res, opts.onEvent, opts.signal);
    return true;
  } catch {
    return false;
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
    // args_continue may return {ok,released} without events — still success
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "user_cancelled" }),
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
  sse: boolean;
  kv: boolean;
  ai: boolean;
  ts?: string;
};

/** Same-origin Worker probe — proves HTTP API (not SPA HTML fallback). */
export async function probeWorkerHealth(
  signal?: AbortSignal,
): Promise<WorkerHealth | null> {
  try {
    const res = await fetch("/workbench/api/health", {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const data = (await res.json()) as WorkerHealth;
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}
