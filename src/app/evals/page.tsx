import Link from "next/link";
import evalResults from "@/data/eval-results.json";
import workersAiSpot from "@/data/eval-workers-ai-spot.json";
import scenariosData from "@/data/scenarios.json";

export default function EvalsPage() {
  const { meta, aggregate, cases } = evalResults;
  const failureScenarios = scenariosData.scenarios.filter(
    (s) => (s.failureFocus?.length ?? 0) > 0 || s.tags?.includes("failure"),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Evaluation dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-50">합성 벤치마크</h1>
      <p className="mt-2 text-sm text-zinc-400">
        모델 <code className="text-zinc-300">{meta.model}</code> · prompt{" "}
        <code className="text-zinc-300">{meta.promptVersion}</code> · runs/case{" "}
        {meta.runsPerCase} · n={aggregate.scenarioCount} · updated {meta.updated}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-500">
        {meta.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 hover:underline">
          ← 워크벤치
        </Link>
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="시나리오 (n)" value={String(aggregate.scenarioCount)} />
        <Stat label="fixture 커버" value={String(aggregate.fixtureCoverage)} />
        <Stat label="실패 시연 시나리오" value={String(failureScenarios.length)} />
        <Stat label="workflow completion" value={fmt(aggregate.workflowCompletionRate)} />
        <Stat label="schema valid rate" value={fmt(aggregate.schemaValidRate)} />
        <Stat label="conflict recall" value={fmt(aggregate.conflictRecall)} />
        <Stat label="TTFT p50 (ms)" value={num(aggregate.ttftP50Ms)} />
        <Stat label="TTFT p95 (ms)" value={num(aggregate.ttftP95Ms)} />
        <Stat label="취소 응답 p50 (ms)" value={num(aggregate.cancelLatencyP50Ms)} />
        <Stat
          label="워크플로 완료 p50 (ms)"
          value={num(
            "workflowP50Ms" in aggregate
              ? (aggregate.workflowP50Ms as number | null)
              : null,
          )}
        />
        <Stat
          label="워크플로 완료 p95 (ms)"
          value={num(
            "workflowP95Ms" in aggregate
              ? (aggregate.workflowP95Ms as number | null)
              : null,
          )}
        />
        <Stat label="재연결 성공률" value={fmt(aggregate.reconnectSuccessRate)} />
        <Stat label="중복 side effect" value={String(aggregate.duplicateSideEffects)} />
        <Stat
          label="a11y/격리 탐지율"
          value={fmt(
            "a11yDefectDetectionRate" in aggregate
              ? (aggregate.a11yDefectDetectionRate as number | null)
              : null,
          )}
        />
        <Stat
          label="도구 재시도 성공률"
          value={fmt(
            "toolRetrySuccessRate" in aggregate
              ? (aggregate.toolRetrySuccessRate as number | null)
              : null,
          )}
        />
      </section>

      <section className="mt-10 rounded-xl border border-sky-900/50 bg-sky-950/20 p-4">
        <h2 className="text-lg font-medium text-sky-100">Workers AI spot (별도 표본)</h2>
        <p className="mt-1 text-xs text-sky-200/70">
          model <code>{workersAiSpot.meta.model}</code> · prompt{" "}
          <code>{workersAiSpot.meta.promptVersion}</code> · n=
          {workersAiSpot.meta.sampleSize} · runs/case {workersAiSpot.meta.runsPerCase} ·{" "}
          {workersAiSpot.meta.updated}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat
            label="requirements.ready rate"
            value={fmt(workersAiSpot.aggregate.requirementsReadyRate)}
          />
          <Stat
            label="schemaInvalid observed"
            value={String(workersAiSpot.aggregate.schemaInvalidObserved)}
          />
          <Stat
            label="fallback rate"
            value={fmt(workersAiSpot.aggregate.fallbackRate ?? null)}
          />
          <Stat label="TTFT p50 (ms)" value={num(workersAiSpot.aggregate.ttftP50Ms)} />
          <Stat label="TTFT p95 (ms)" value={num(workersAiSpot.aggregate.ttftP95Ms)} />
          <Stat
            label="source quote rate"
            value={fmt(
              "sourceQuoteRate" in workersAiSpot.aggregate
                ? (workersAiSpot.aggregate.sourceQuoteRate as number | null)
                : null,
            )}
          />
          <Stat
            label="cost / request"
            value={
              workersAiSpot.aggregate.costUsdPerRequest == null
                ? "— (미계측)"
                : String(workersAiSpot.aggregate.costUsdPerRequest)
            }
          />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-sky-200/60">
          {workersAiSpot.meta.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-xs text-zinc-500">
        mock TTFT는 fixture delay 기준. Workers AI 표는 mock n=32와 합산하지 않음.
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">scenario</th>
              <th className="px-3 py-2">fixture</th>
              <th className="px-3 py-2">outcome</th>
              <th className="px-3 py-2">schema</th>
              <th className="px-3 py-2">ttftMs</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.scenarioId} className="border-b border-zinc-900 text-zinc-300">
                <td className="px-3 py-2 font-mono text-xs">{c.scenarioId}</td>
                <td className="px-3 py-2 text-xs">{c.fixture}</td>
                <td className="px-3 py-2">{c.outcome}</td>
                <td className="px-3 py-2">{c.schemaValid ? "valid" : "invalid"}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {"ttftMs" in c && c.ttftMs != null ? c.ttftMs : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl text-zinc-100">{value}</p>
    </div>
  );
}

function fmt(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 1000) / 10}%`;
}

function num(v: number | null) {
  return v === null ? "—" : String(v);
}
