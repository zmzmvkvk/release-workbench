import { describe, expect, it } from "vitest";
import { applyEvents, initialRunState } from "./protocol";
import { buildRunDataStages } from "../components/run-data-inspector";

describe("run data inspector stages", () => {
  it("marks citation blocked when approve is blocked", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-16T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", scenarioId: "rw-012", idempotencyKey: "k" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-16T00:00:01.000Z",
        type: "citation.missing",
        payload: { reqId: "r1" },
      },
      {
        id: "3",
        runId: "r1",
        seq: 2,
        ts: "2026-09-16T00:00:02.000Z",
        type: "requirements.ready",
        payload: {
          requirements: [{ id: "r1", text: "x", citations: [] }],
          conflicts: [],
        },
      },
    ]);
    const stages = buildRunDataStages(state);
    expect(stages.find((s) => s.id === "citation")?.status).toBe("blocked");
    expect(stages.find((s) => s.id === "extract")?.status).toBe("done");
  });

  it("marks eval done when case recorded", () => {
    const state = applyEvents(initialRunState(), [
      {
        id: "1",
        runId: "r1",
        seq: 0,
        ts: "2026-09-16T00:00:00.000Z",
        type: "run.started",
        payload: { mode: "mock", scenarioId: "rw-027", idempotencyKey: "k" },
      },
      {
        id: "2",
        runId: "r1",
        seq: 1,
        ts: "2026-09-16T00:00:01.000Z",
        type: "eval.case_recorded",
        payload: { caseId: "rw-027", outcome: "gate_rejected" },
      },
    ]);
    expect(buildRunDataStages(state).find((s) => s.id === "eval")?.status).toBe(
      "done",
    );
  });
});
