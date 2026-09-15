import { buildFixtureSteps, type FixtureId } from "./fixtures";
import { buildExecuteSteps } from "./execute-fixtures";
import type { WorkbenchEvent } from "./protocol";

type Step =
  | {
      kind: "event";
      delayMs: number;
      partial: { type: WorkbenchEvent["type"]; payload: unknown };
    }
  | { kind: "waitCancel"; delayMs: number }
  | { kind: "waitArgsEdit"; timeoutMs: number };

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal?.aborted) {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type ClientRun = {
  runId: string;
  seq: number;
  cancelled: boolean;
  /** Resolve when HITL edits tool args (or timeout). */
  notifyArgsEdited?: () => void;
};

export function createClientRun(): ClientRun {
  return {
    runId: `run_${Date.now().toString(36)}`,
    seq: 0,
    cancelled: false,
  };
}

function nextEvent(
  run: ClientRun,
  type: WorkbenchEvent["type"],
  payload: unknown,
): WorkbenchEvent {
  const event: WorkbenchEvent = {
    id: `evt_${run.runId}_${run.seq}`,
    runId: run.runId,
    seq: run.seq,
    ts: new Date().toISOString(),
    type,
    payload,
  };
  run.seq += 1;
  return event;
}

async function playSteps(
  run: ClientRun,
  steps: Step[],
  onEvent: (e: WorkbenchEvent) => void,
  signal?: AbortSignal,
) {
  for (const step of steps) {
    if (signal?.aborted || run.cancelled) {
      onEvent(nextEvent(run, "run.cancelled", { reason: "user_cancelled" }));
      return;
    }
    if (step.kind === "waitCancel") {
      try {
        await sleep(step.delayMs, signal);
      } catch {
        run.cancelled = true;
        onEvent(nextEvent(run, "run.cancelled", { reason: "user_cancelled" }));
        return;
      }
      continue;
    }
    if (step.kind === "waitArgsEdit") {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, step.timeoutMs);
        run.notifyArgsEdited = () => {
          clearTimeout(timer);
          resolve();
        };
        if (signal?.aborted) {
          clearTimeout(timer);
          resolve();
        } else {
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        }
      });
      run.notifyArgsEdited = undefined;
      continue;
    }
    try {
      await sleep(step.delayMs, signal);
    } catch {
      run.cancelled = true;
      onEvent(nextEvent(run, "run.cancelled", { reason: "user_cancelled" }));
      return;
    }
    if (run.cancelled || signal?.aborted) {
      onEvent(nextEvent(run, "run.cancelled", { reason: "user_cancelled" }));
      return;
    }
    onEvent(nextEvent(run, step.partial.type, step.partial.payload));
  }
}

export async function runStructuringMock(opts: {
  run: ClientRun;
  scenarioId: string;
  fixture: FixtureId;
  idempotencyKey: string;
  onEvent: (e: WorkbenchEvent) => void;
  signal?: AbortSignal;
  /** Simulate duplicate block without starting */
  forceDuplicate?: boolean;
}) {
  if (opts.forceDuplicate || opts.fixture === "duplicate_blocked") {
    opts.onEvent(
      nextEvent(opts.run, "run.duplicate_blocked", {
        existingRunId: "run_existing_demo",
      }),
    );
    return;
  }

  // Patch first step payload idempotency to match client key
  const steps = buildFixtureSteps(opts.fixture, opts.scenarioId).map((s) => {
    if (s.kind === "event" && s.partial.type === "run.started") {
      return {
        ...s,
        partial: {
          ...s.partial,
          payload: {
            ...(s.partial.payload as object),
            idempotencyKey: opts.idempotencyKey,
            scenarioId: opts.scenarioId,
            mode: "mock",
          },
        },
      };
    }
    return s;
  });

  await playSteps(opts.run, steps, opts.onEvent, opts.signal);
}

export async function runExecuteMock(opts: {
  run: ClientRun;
  scenarioId: string;
  onEvent: (e: WorkbenchEvent) => void;
  signal?: AbortSignal;
  /** Non-interactive runners (bench) auto-release the HITL args gate. */
  autoReleaseArgsMs?: number;
}) {
  opts.onEvent(nextEvent(opts.run, "plan.approved", { by: "user" }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (opts.autoReleaseArgsMs != null) {
    timer = setTimeout(() => opts.run.notifyArgsEdited?.(), opts.autoReleaseArgsMs);
  }
  try {
    await playSteps(
      opts.run,
      buildExecuteSteps(opts.scenarioId),
      opts.onEvent,
      opts.signal,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function emitClientEvent(
  run: ClientRun,
  type: WorkbenchEvent["type"],
  payload: unknown,
  onEvent: (e: WorkbenchEvent) => void,
) {
  onEvent(nextEvent(run, type, payload));
  if (type === "tool.args_edited") {
    run.notifyArgsEdited?.();
  }
}
