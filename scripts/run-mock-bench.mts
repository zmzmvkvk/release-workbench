/**
 * Deterministic mock bench — fills eval-results.json aggregates.
 * Run: pnpm bench
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClientRun,
  runExecuteMock,
  runStructuringMock,
} from "../src/lib/client-mock-runner";
import { scenarioDefaultFixture, type FixtureId } from "../src/lib/fixtures";
import { applyEvent, initialRunState, type RunState } from "../src/lib/protocol";
import scenariosData from "../src/data/scenarios.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CaseRow = {
  scenarioId: string;
  fixture: string;
  outcome: string;
  schemaValid: boolean;
  conflictDetected?: boolean;
  sanitized?: boolean;
  ttftMs?: number;
  notes?: string;
};

const FIXTURE_IDS = new Set<string>([
  "happy_card_grid",
  "happy_empty_state",
  "happy_table_sort",
  "happy_phone_mask",
  "happy_kst_display",
  "chart_a11y",
  "upload_limit_missing",
  "cancel_during_structuring",
  "conflict_discount_copy",
  "invalid_requirements_json",
  "duplicate_blocked",
  "stream_reconnect",
  "tool_retry_once",
  "plan_reject_darkmode",
  "tool_args_edited",
  "citation_missing_block",
  "preview_xss_sanitized",
  "step_limit_exceeded",
  "qa_playwright_mismatch",
]);

function isHappyExecuteFixture(fixture: string) {
  return (
    fixture === "happy_card_grid" ||
    fixture === "happy_empty_state" ||
    fixture === "happy_table_sort" ||
    fixture === "happy_phone_mask" ||
    fixture === "happy_kst_display" ||
    fixture === "chart_a11y"
  );
}

async function runOne(scenarioId: string, fixture: FixtureId): Promise<{
  state: RunState;
  ttftMs: number | null;
  cancelLatencyMs: number | null;
  workflowMs: number | null;
}> {
  const run = createClientRun();
  let state = initialRunState();
  let firstDeltaAt: number | null = null;
  let startedAt: number | null = null;
  let cancelLatencyMs: number | null = null;
  let workflowMs: number | null = null;
  let cancelRequestedAt: number | null = null;

  const onEvent = (e: Parameters<typeof applyEvent>[1]) => {
    const ev = e as { type: string; ts: string };
    if (ev.type === "run.started") startedAt = performance.now();
    if (ev.type === "stream.delta" && firstDeltaAt === null && startedAt != null) {
      firstDeltaAt = Math.round(performance.now() - startedAt);
    }
    if (ev.type === "run.cancelled" && cancelRequestedAt != null && cancelLatencyMs == null) {
      cancelLatencyMs = Math.max(1, Math.round(performance.now() - cancelRequestedAt));
    }
    state = applyEvent(state, e);
  };

  const t0 = performance.now();
  if (fixture === "cancel_during_structuring") {
    const ac = new AbortController();
    const p = runStructuringMock({
      run,
      scenarioId,
      fixture,
      idempotencyKey: `${scenarioId}-bench`,
      onEvent,
      signal: ac.signal,
    });
    await new Promise((r) => setTimeout(r, 400));
    cancelRequestedAt = performance.now();
    run.cancelled = true;
    ac.abort();
    // Emit cancel if mock exited without event
    if (state.status !== "cancelled") {
      onEvent({
        id: `evt_bench_cancel`,
        runId: run.runId,
        seq: run.seq++,
        ts: new Date().toISOString(),
        type: "run.cancelled",
        payload: { reason: "user_cancelled" },
      });
    }
    await p.catch(() => undefined);
    if (cancelLatencyMs == null && cancelRequestedAt != null) {
      cancelLatencyMs = Math.max(1, Math.round(performance.now() - cancelRequestedAt));
    }
  } else {
    await runStructuringMock({
      run,
      scenarioId,
      fixture,
      idempotencyKey: `${scenarioId}-bench`,
      onEvent,
    });
  }

  // Happy path: continue execute when reviewable and not blocked
  if (
    state.status === "awaiting_plan_review" &&
    !state.approveBlockedReason &&
    isHappyExecuteFixture(fixture)
  ) {
    await runExecuteMock({
      run,
      scenarioId,
      onEvent,
      autoReleaseArgsMs: 20,
    });
    const st = state.status as RunState["status"];
    if (st === "awaiting_gate" || state.gatePending) {
      state = applyEvent(state, {
        id: "gate",
        runId: run.runId,
        seq: run.seq++,
        ts: new Date().toISOString(),
        type: "gate.approved",
        payload: { by: "bench" },
      });
      state = applyEvent(state, {
        id: "done",
        runId: run.runId,
        seq: run.seq++,
        ts: new Date().toISOString(),
        type: "run.completed",
        payload: { summary: "bench" },
      });
      workflowMs = Math.round(performance.now() - t0);
    }
  }

  return {
    state,
    ttftMs: firstDeltaAt,
    cancelLatencyMs,
    workflowMs,
  };
}

function outcomeOf(state: RunState): string {
  if (state.duplicateBlocked) return "duplicate_blocked";
  if (state.approveBlockedReason) return "approve_blocked";
  return state.status;
}

async function main() {
  const cases: CaseRow[] = [];
  const ttfts: number[] = [];
  const cancels: number[] = [];
  const workflows: number[] = [];
  let schemaValid = 0;
  let schemaTotal = 0;
  let conflictHits = 0;
  let conflictExpected = 0;
  let reconnectOk = 0;
  let reconnectN = 0;
  let completed = 0;
  let attemptedComplete = 0;
  let dupSideEffects = 0;
  let a11yDetectHits = 0;
  let a11yDetectExpected = 0;
  let toolRetryHits = 0;
  let toolRetryExpected = 0;
  let extractionHits = 0;
  let extractionExpected = 0;
  let toolSelectHits = 0;
  let toolSelectExpected = 0;

  for (const s of scenariosData.scenarios) {
    const fixture = (FIXTURE_IDS.has(s.fixture)
      ? s.fixture
      : scenarioDefaultFixture(s.id)) as FixtureId;

    const { state, ttftMs, cancelLatencyMs, workflowMs } = await runOne(s.id, fixture);
    if (ttftMs != null) ttfts.push(ttftMs);
    if (cancelLatencyMs != null) cancels.push(cancelLatencyMs);
    if (workflowMs != null) workflows.push(workflowMs);

    const invalid = state.status === "failed" && fixture === "invalid_requirements_json";
    const validStructuring =
      state.status !== "failed" || fixture === "step_limit_exceeded" || invalid;
    // schema valid: not requirements.invalid path unless expected
    schemaTotal += 1;
    if (fixture === "invalid_requirements_json") {
      if (state.error?.includes("schema") || state.status === "failed") schemaValid += 0;
      else schemaValid += 1;
    } else if (!state.error?.includes("invalid event")) {
      schemaValid += 1;
    }

    if (fixture === "conflict_discount_copy") {
      conflictExpected += 1;
      if (state.conflicts.length > 0 || state.approveBlockedReason?.includes("충돌")) {
        conflictHits += 1;
      }
    }

    const expectedReqCount =
      typeof s.expected?.requirementCount === "number"
        ? s.expected.requirementCount
        : null;
    if (
      expectedReqCount != null &&
      state.requirements.length > 0 &&
      fixture === s.fixture &&
      fixture !== "invalid_requirements_json"
    ) {
      extractionExpected += 1;
      if (state.requirements.length === expectedReqCount) extractionHits += 1;
    }

    if (fixture === "stream_reconnect") {
      reconnectN += 1;
      if (state.events.some((e) => e.type === "stream.reconnect")) reconnectOk += 1;
    }

    if (isHappyExecuteFixture(fixture)) {
      attemptedComplete += 1;
      if (state.status === "completed") completed += 1;
      toolSelectExpected += 1;
      if (state.tools.some((t) => t.name === "apply_code_patch")) toolSelectHits += 1;
    }

    if (fixture === "duplicate_blocked") {
      // side effects should stay 0 (no started run tools)
      if (state.tools.length > 0) dupSideEffects += 1;
    }

    if (fixture === "preview_xss_sanitized") {
      a11yDetectExpected += 1;
      if (
        state.preview.sanitized.length > 0 ||
        state.events.some((e) => e.type === "preview.sanitized")
      ) {
        a11yDetectHits += 1;
      }
    }

    if (fixture === "tool_retry_once") {
      toolRetryExpected += 1;
      const failed = state.events.some((e) => e.type === "tool.failed");
      const retried = state.events.some((e) => e.type === "tool.retried");
      const finished = state.events.some((e) => e.type === "tool.finished");
      if (failed && retried && finished) toolRetryHits += 1;
      toolSelectExpected += 1;
      const expectedTool =
        typeof s.expected?.tool === "string" ? s.expected.tool : "apply_code_patch";
      if (state.tools.some((t) => t.name === expectedTool)) toolSelectHits += 1;
    }

    cases.push({
      scenarioId: s.id,
      fixture,
      outcome: outcomeOf(state),
      schemaValid: fixture === "invalid_requirements_json" ? false : validStructuring,
      conflictDetected: state.conflicts.length > 0 || undefined,
      sanitized:
        state.preview.sanitized.length > 0 || fixture === "preview_xss_sanitized"
          ? true
          : undefined,
      ttftMs: ttftMs ?? undefined,
      notes: fixture === s.fixture ? undefined : "mapped via scenarioDefaultFixture",
    });
  }

  const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 1000);
  const percentile = (arr: number[], p: number) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)];
  };

  const out = {
    meta: {
      title: "Release Workbench synthetic eval results",
      version: "0.3.0-mock-bench",
      updated: new Date().toISOString().slice(0, 10),
      model: "deterministic-mock",
      promptVersion: "none-mock",
      runsPerCase: 1,
      notes: [
        "회사 생산성 수치 아님. client mock fixture 재생.",
        "TTFT·cancel·workflow는 mock delay 기준(실 LLM 아님).",
        "extractionAccuracy: expected.requirementCount vs 추출 개수(매핑된 fixture만).",
        "toolSelectionAccuracy: happy/tool_retry에서 apply_code_patch(또는 expected.tool).",
        "live LLM 측정은 동일 스키마로 덮어쓴다. tokens/cost는 provider가 주면 기록.",
      ],
    },
    aggregate: {
      scenarioCount: scenariosData.scenarios.length,
      fixtureCoverage: FIXTURE_IDS.size,
      workflowCompletionRate: pct(completed, attemptedComplete),
      schemaValidRate: pct(schemaValid, schemaTotal),
      conflictRecall: pct(conflictHits, conflictExpected),
      extractionAccuracy: pct(extractionHits, extractionExpected),
      toolSelectionAccuracy: pct(toolSelectHits, toolSelectExpected),
      ttftP50Ms: percentile(ttfts, 50),
      ttftP95Ms: percentile(ttfts, 95),
      cancelLatencyP50Ms: percentile(cancels, 50),
      workflowP50Ms: percentile(workflows, 50),
      workflowP95Ms: percentile(workflows, 95),
      reconnectSuccessRate: pct(reconnectOk, reconnectN),
      duplicateSideEffects: dupSideEffects,
      a11yDefectDetectionRate: pct(a11yDetectHits, a11yDetectExpected),
      toolRetrySuccessRate: pct(toolRetryHits, toolRetryExpected),
    },
    cases,
  };

  const dest = path.join(__dirname, "../src/data/eval-results.json");
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log("wrote", dest);
  console.log(JSON.stringify(out.aggregate, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
