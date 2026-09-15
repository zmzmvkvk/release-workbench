import type { WorkbenchEvent } from "./protocol";

export type ActiveRun = {
  runId: string;
  idempotencyKey: string;
  scenarioId: string;
  fixture: string;
  createdAt: number;
  cancelled: boolean;
  abort: AbortController;
  events: WorkbenchEvent[];
};

const globalStore = globalThis as typeof globalThis & {
  __workbenchRuns?: Map<string, ActiveRun>;
  __workbenchByKey?: Map<string, string>;
};

function runs() {
  if (!globalStore.__workbenchRuns) globalStore.__workbenchRuns = new Map();
  return globalStore.__workbenchRuns;
}

function byKey() {
  if (!globalStore.__workbenchByKey) globalStore.__workbenchByKey = new Map();
  return globalStore.__workbenchByKey;
}

export function getRun(runId: string) {
  return runs().get(runId);
}

export function findByIdempotencyKey(key: string) {
  const id = byKey().get(key);
  return id ? runs().get(id) : undefined;
}

export function createRun(input: {
  runId: string;
  idempotencyKey: string;
  scenarioId: string;
  fixture: string;
}): ActiveRun | { duplicate: true; existing: ActiveRun } {
  const existing = findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    const terminal = existing.cancelled ||
      existing.events.some((e) =>
        ["run.completed", "run.failed", "run.cancelled", "plan.rejected", "gate.rejected", "requirements.invalid"].includes(
          e.type,
        ),
      );
    if (!terminal) {
      return { duplicate: true, existing };
    }
  }

  const run: ActiveRun = {
    ...input,
    createdAt: Date.now(),
    cancelled: false,
    abort: new AbortController(),
    events: [],
  };
  runs().set(run.runId, run);
  byKey().set(run.idempotencyKey, run.runId);
  return run;
}

export function cancelRun(runId: string, reason: string): WorkbenchEvent | null {
  const run = runs().get(runId);
  if (!run || run.cancelled) return null;
  run.cancelled = true;
  run.abort.abort(reason);
  const event: WorkbenchEvent = {
    id: `evt_${run.events.length + 1}`,
    runId,
    seq: run.events.length,
    ts: new Date().toISOString(),
    type: "run.cancelled",
    payload: { reason },
  };
  run.events.push(event);
  return event;
}

export function appendEvent(run: ActiveRun, type: WorkbenchEvent["type"], payload: unknown): WorkbenchEvent {
  const event: WorkbenchEvent = {
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
