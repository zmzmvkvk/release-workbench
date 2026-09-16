import { describe, expect, it } from "vitest";
import { applyEvent, applyEvents, initialRunState } from "./protocol";

describe("workbench protocol reducer", () => {
  it("moves idle → structuring → awaiting_plan_review", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-15T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", idempotencyKey: "k", scenarioId: "rw-004" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-15T00:00:01.000Z",
        type: "requirements.ready",
        payload: { requirements: [{ id: "a" }], conflicts: [] },
      },
    ]);
    expect(state.status).toBe("awaiting_plan_review");
    expect(state.requirements).toHaveLength(1);
  });

  it("ignores duplicate seq on reconnect", () => {
    const first = applyEvent(initialRunState(), {
      id: "1",
      runId: "r1",
      seq: 0,
      ts: "2026-09-15T00:00:00.000Z",
      type: "run.started",
      payload: { mode: "mock", idempotencyKey: "k" },
    });
    const second = applyEvent(first, {
      id: "1",
      runId: "r1",
      seq: 0,
      ts: "2026-09-15T00:00:00.000Z",
      type: "run.started",
      payload: { mode: "mock", idempotencyKey: "k" },
    });
    expect(second.events).toHaveLength(1);
  });

  it("handles cancel", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-15T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", idempotencyKey: "k" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-15T00:00:02.000Z",
        type: "run.cancelled",
        payload: { reason: "user_cancelled" },
      },
    ]);
    expect(state.status).toBe("cancelled");
  });

  it("blocks approve when citations missing", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-15T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", idempotencyKey: "k" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-15T00:00:01.000Z",
        type: "citation.missing",
        payload: { reqId: "r1" },
      },
      {
        id: "3",
        runId: "r1",
        seq: 2,
        ts: "2026-09-15T00:00:02.000Z",
        type: "requirements.ready",
        payload: { requirements: [{ id: "r1", citations: [] }], conflicts: [] },
      },
    ]);
    expect(state.approveBlockedReason).toMatch(/근거/);
  });

  it("stores diffs and enters awaiting_gate after qa", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-15T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", idempotencyKey: "k" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-15T00:00:01.000Z",
        type: "plan.approved",
        payload: { by: "user" },
      },
      {
        id: "3",
        runId: "r1",
        seq: 2,
        ts: "2026-09-15T00:00:02.000Z",
        type: "diff.updated",
        payload: {
          files: [{ path: "A.tsx", additions: 1, deletions: 0, patch: "+x" }],
        },
      },
      {
        id: "4",
        runId: "r1",
        seq: 3,
        ts: "2026-09-15T00:00:03.000Z",
        type: "qa.finished",
        payload: {
          report: {
            passed: true,
            suites: [{ name: "axe", passed: true, detail: "0" }],
          },
        },
      },
    ]);
    expect(state.status).toBe("awaiting_gate");
    expect(state.diffs).toHaveLength(1);
    expect(state.qa?.passed).toBe(true);
  });

  it("records cancelLatencyMs on run.cancelled", () => {
    const state = applyEvent(initialRunState(), {
      id: "1",
      runId: "r1",
      seq: 0,
      ts: "2026-09-15T00:00:00.000Z",
      type: "run.cancelled",
      payload: { reason: "user_cancelled", cancelLatencyMs: 42 },
    });
    expect(state.status).toBe("cancelled");
    expect(state.metrics?.cancelLatencyMs).toBe(42);
  });

  it("records args_gate_released on timeline and traces without changing status", () => {
    const base = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-15T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", idempotencyKey: "k", scenarioId: "rw-004" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-15T00:00:01.000Z",
        type: "plan.approved",
        payload: { by: "user" },
      },
      {
        id: "3",
        runId: "r1",
        seq: 2,
        ts: "2026-09-15T00:00:02.000Z",
        type: "tool.started",
        payload: { callId: "t1", name: "propose_patch_plan", args: {} },
      },
    ]);
    expect(base.status).toBe("executing");
    const state = applyEvent(base, {
      id: "4",
      runId: "r1",
      seq: 3,
      ts: "2026-09-15T00:00:14.000Z",
      type: "tool.args_gate_released",
      payload: { reason: "soft_timeout", softTimeoutMs: 12_000, callId: "t1" },
    });
    expect(state.status).toBe("executing");
    expect(state.timeline.at(-1)?.summary).toMatch(/soft-timeout/);
    expect(state.traces.some((t) => t.name === "args_gate_released")).toBe(
      true,
    );
    expect(
      (state.traces.find((t) => t.name === "args_gate_released")?.attrs as {
        reason?: string;
      })?.reason,
    ).toBe("soft_timeout");
  });

  it("keeps costUsd null and records promptVersion from metrics.sample", () => {
    const state = applyEvent(initialRunState(), {
      id: "1",
      runId: "r1",
      seq: 0,
      ts: "2026-09-15T00:00:00.000Z",
      type: "metrics.sample",
      payload: {
        ttftMs: 120,
        tokens: 200,
        costUsd: null,
        provider: "workers-ai",
        model: "@cf/meta/llama-3.2-3b-instruct",
        promptVersion: "workers-ai-struct-v3",
      },
    });
    expect(state.metrics?.costUsd).toBeNull();
    expect(state.metrics?.tokens).toBe(200);
    expect(state.metrics?.promptVersion).toBe("workers-ai-struct-v3");
    expect(state.metrics?.provider).toBe("workers-ai");
  });
});
