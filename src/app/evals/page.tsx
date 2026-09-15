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
      <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
        라이브 HTTP HITL: execute 첫 도구에서 Worker가 일시정지 →{" "}
        <code className="text-zinc-300">args_continue</code> /{" "}
        <code className="text-zinc-300">args_edit</code> (KV, isolate-safe). Workers AI
        모드에서는 계획 승인 직후 라이브{" "}
        <code className="text-zinc-300">propose_patch_plan</code> (prompt{" "}
        <code className="text-zinc-300">workers-ai-patch-v1</code>) 도구 스텝이 들어간 뒤
        deterministic execute fixture가 이어집니다. 미리보기는 DOMPurify +{" "}
        <code className="text-zinc-300">sandbox=&quot;&quot;</code>. 벤치 숫자는
        deterministic mock이며 Workers AI는 아래 spot 표만 사용.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="시나리오 (n)" value={String(aggregate.scenarioCount)} />
        <Stat label="fixture 커버" value={String(aggregate.fixtureCoverage)} />
        <Stat label="실패 시연 시나리오" value={String(failureScenarios.length)} />
        <Stat label="workflow completion" value={fmt(aggregate.workflowCompletionRate)} />
        <Stat label="schema valid rate" value={fmt(aggregate.schemaValidRate)} />
        <Stat label="conflict recall" value={fmt(aggregate.conflictRecall)} />
        <Stat
          label="요구사항 추출 정확도"
          value={fmt(
            "extractionAccuracy" in aggregate
              ? (aggregate.extractionAccuracy as number | null)
              : null,
          )}
        />
        <Stat
          label="도구 선택 정확도"
          value={fmt(
            "toolSelectionAccuracy" in aggregate
              ? (aggregate.toolSelectionAccuracy as number | null)
              : null,
          )}
        />
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

      <section className="mt-10" id="failures">
        <h2 className="text-lg font-medium text-zinc-100">실패·복구 시연 매트릭스</h2>
        <p className="mt-1 text-xs text-zinc-500">
          채용 검토용 원클릭 (trailing slash + mock). 상세는{" "}
          <code className="text-zinc-400">docs/FAILURE_CASES.md</code>.
        </p>
        <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {[
            ["rw-027", "QA 실패 → 게이트 거절 → eval 기록"],
            ["rw-005", "스트리밍 중 취소 (+ cancel latency)"],
            ["rw-006", "네트워크 끊김 후 재개"],
            ["rw-007", "잘못된 구조화 JSON"],
            ["rw-008", "도구 실패 후 재시도"],
            ["rw-009", "계획 거절"],
            ["rw-011", "중복 실행 차단"],
            ["rw-012", "근거 없는 요구 생성 거절"],
            ["rw-013", "위험한 HTML 격리"],
            ["rw-014", "최대 실행 단계 초과"],
          ].map(([id, label]) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-zinc-300">
                <code className="text-amber-200/90">{id}</code> · {label}
              </span>
              <a
                className="text-xs text-emerald-400 hover:underline"
                href={`/workbench/?mock=1&scenario=${id}&filter=failure&autorun=1`}
              >
                자동실행
              </a>
            </li>
          ))}
        </ul>
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
            label="tokens p50"
            value={num(
              "tokensP50" in workersAiSpot.aggregate
                ? (workersAiSpot.aggregate.tokensP50 as number | null)
                : null,
            )}
          />
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
        <div className="mt-4 overflow-x-auto rounded-lg border border-sky-900/40">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-sky-900/40 text-xs text-sky-200/60">
              <tr>
                <th className="px-3 py-2">scenario</th>
                <th className="px-3 py-2">ready</th>
                <th className="px-3 py-2">sourceQuote</th>
                <th className="px-3 py-2">ttftMs</th>
                <th className="px-3 py-2">tokens</th>
              </tr>
            </thead>
            <tbody>
              {workersAiSpot.cases.map((c) => (
                <tr key={c.scenarioId} className="border-b border-sky-950/60 text-sky-100/90">
                  <td className="px-3 py-2 font-mono text-xs">{c.scenarioId}</td>
                  <td className="px-3 py-2">{c.requirementsReady ? "yes" : "no"}</td>
                  <td className="px-3 py-2">
                    {"sourceQuote" in c && c.sourceQuote ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.ttftMs != null ? c.ttftMs : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {"tokens" in c && c.tokens != null ? String(c.tokens) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
