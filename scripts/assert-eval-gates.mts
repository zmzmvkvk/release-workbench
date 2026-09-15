/**
 * Fail CI if committed eval artifacts regress below hiring gates.
 * Run after `pnpm bench` (or against checked-in results).
 * Also writes public/data/eval-summary.json for GET /workbench/api/evals.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evalResults = JSON.parse(
  readFileSync(resolve(root, "src/data/eval-results.json"), "utf8"),
) as {
  meta?: {
    model?: string;
    promptVersion?: string;
    runsPerCase?: number;
  };
  aggregate: {
    scenarioCount: number;
    extractionAccuracy: number;
    toolSelectionAccuracy: number;
    conflictRecall: number;
    workflowCompletionRate: number;
    duplicateSideEffects: number;
    schemaValidRate: number;
  };
};
const scenarios = JSON.parse(
  readFileSync(resolve(root, "src/data/scenarios.json"), "utf8"),
) as { meta: { count: number }; scenarios: unknown[] };
const spot = JSON.parse(
  readFileSync(resolve(root, "src/data/eval-workers-ai-spot.json"), "utf8"),
) as {
  aggregate: {
    sampleSize: number;
    requirementsReadyRate: number;
    sourceQuoteRate: number;
    costUsdPerRequest: number | null;
  };
  meta: { promptVersion: string };
};

const failures: string[] = [];
const a = evalResults.aggregate;

if (scenarios.meta.count < 35) failures.push(`scenarios.meta.count ${scenarios.meta.count} < 35`);
if (scenarios.scenarios.length !== scenarios.meta.count) {
  failures.push(
    `scenarios length ${scenarios.scenarios.length} != meta.count ${scenarios.meta.count}`,
  );
}
if (a.scenarioCount < 35) failures.push(`eval scenarioCount ${a.scenarioCount} < 35`);
if (a.extractionAccuracy < 1) failures.push(`extractionAccuracy ${a.extractionAccuracy} < 1`);
if (a.toolSelectionAccuracy < 1) {
  failures.push(`toolSelectionAccuracy ${a.toolSelectionAccuracy} < 1`);
}
if (a.conflictRecall < 1) failures.push(`conflictRecall ${a.conflictRecall} < 1`);
if (a.workflowCompletionRate < 1) {
  failures.push(`workflowCompletionRate ${a.workflowCompletionRate} < 1`);
}
if (a.duplicateSideEffects !== 0) {
  failures.push(`duplicateSideEffects ${a.duplicateSideEffects} != 0`);
}
if (a.schemaValidRate < 0.9) failures.push(`schemaValidRate ${a.schemaValidRate} < 0.9`);

if (spot.aggregate.sampleSize < 5) {
  failures.push(`workers-ai spot sampleSize ${spot.aggregate.sampleSize} < 5`);
}
if (spot.aggregate.requirementsReadyRate < 1) {
  failures.push(`workers-ai readyRate ${spot.aggregate.requirementsReadyRate} < 1`);
}
if (spot.aggregate.sourceQuoteRate < 1) {
  failures.push(`workers-ai sourceQuoteRate ${spot.aggregate.sourceQuoteRate} < 1`);
}
if (spot.aggregate.costUsdPerRequest != null) {
  failures.push("workers-ai costUsdPerRequest must stay null (no invented cost)");
}
if (spot.meta.promptVersion !== "workers-ai-struct-v3") {
  failures.push(`unexpected spot promptVersion ${spot.meta.promptVersion}`);
}

if (failures.length) {
  console.error("eval gates FAILED:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

const summary = {
  ok: true,
  source: "bench-gates",
  updated: new Date().toISOString(),
  mock: {
    scenarioCount: a.scenarioCount,
    extractionAccuracy: a.extractionAccuracy,
    toolSelectionAccuracy: a.toolSelectionAccuracy,
    conflictRecall: a.conflictRecall,
    workflowCompletionRate: a.workflowCompletionRate,
    schemaValidRate: a.schemaValidRate,
    duplicateSideEffects: a.duplicateSideEffects,
    model: evalResults.meta?.model ?? "deterministic-mock",
    promptVersion: evalResults.meta?.promptVersion ?? "none-mock",
    runsPerCase: evalResults.meta?.runsPerCase ?? 1,
  },
  workersAiSpot: {
    sampleSize: spot.aggregate.sampleSize,
    requirementsReadyRate: spot.aggregate.requirementsReadyRate,
    sourceQuoteRate: spot.aggregate.sourceQuoteRate,
    costUsdPerRequest: spot.aggregate.costUsdPerRequest,
    promptVersion: spot.meta.promptVersion,
  },
  gates: {
    scenarioCountMin: 35,
    extractionAccuracyMin: 1,
    toolSelectionAccuracyMin: 1,
    conflictRecallMin: 1,
    schemaValidRateMin: 0.9,
    workersAiSpotSampleMin: 5,
  },
  links: {
    dashboard: "/workbench/evals",
    protocol: "/workbench/api/protocol",
    health: "/workbench/api/health",
  },
};

const outDir = resolve(root, "public/data");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  resolve(outDir, "eval-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));
