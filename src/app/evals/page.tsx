import Link from "next/link";
import evalResults from "@/data/eval-results.json";
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
        {meta.runsPerCase} · updated {meta.updated}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 hover:underline">
          ← 워크벤치
        </Link>
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="시나리오" value={String(aggregate.scenarioCount)} />
        <Stat label="fixture 커버" value={String(aggregate.fixtureCoverage)} />
        <Stat label="실패 시연 시나리오" value={String(failureScenarios.length)} />
        <Stat label="중복 side effect" value={String(aggregate.duplicateSideEffects)} />
        <Stat label="workflow completion" value={fmt(aggregate.workflowCompletionRate)} />
        <Stat label="schema valid rate" value={fmt(aggregate.schemaValidRate)} />
      </section>

      <p className="mt-4 text-xs text-zinc-500">
        null 지표는 live/자동 러너 전. mock 케이스는 아래 표만 확정.
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2">scenario</th>
              <th className="px-3 py-2">fixture</th>
              <th className="px-3 py-2">outcome</th>
              <th className="px-3 py-2">schema</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.scenarioId} className="border-b border-zinc-900 text-zinc-300">
                <td className="px-3 py-2 font-mono text-xs">{c.scenarioId}</td>
                <td className="px-3 py-2 text-xs">{c.fixture}</td>
                <td className="px-3 py-2">{c.outcome}</td>
                <td className="px-3 py-2">{c.schemaValid ? "valid" : "invalid"}</td>
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
