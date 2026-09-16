import { describe, expect, it } from "vitest";
import {
  createClientRun,
  releaseArgsGateContinue,
  runExecuteMock,
  type ClientRun,
} from "./client-mock-runner";
import type { WorkbenchEvent } from "./protocol";

describe("client-mock args gate", () => {
  it("emits tool.args_gate_released with soft_timeout when wait expires", async () => {
    const run = createClientRun();
    const events: WorkbenchEvent[] = [];
    await runExecuteMock({
      run,
      scenarioId: "rw-004",
      onEvent: (e) => events.push(e),
      autoReleaseArgsMs: 5,
    });
    const released = events.find((e) => e.type === "tool.args_gate_released");
    expect(released).toBeTruthy();
    expect((released?.payload as { reason?: string }).reason).toBe(
      "soft_timeout",
    );
  });

  it("emits args_continue reason when releaseArgsGateContinue is called", async () => {
    const run = createClientRun();
    const events: WorkbenchEvent[] = [];
    const done = runExecuteMock({
      run,
      scenarioId: "rw-004",
      onEvent: (e) => {
        events.push(e);
        if (e.type === "tool.started") {
          queueMicrotask(() => releaseArgsGateContinue(run as ClientRun));
        }
      },
      autoReleaseArgsMs: 30_000,
    });
    await done;
    const released = events.find((e) => e.type === "tool.args_gate_released");
    expect((released?.payload as { reason?: string }).reason).toBe(
      "args_continue",
    );
  });
});
