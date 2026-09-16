import type { RunState, WorkbenchEvent } from "@/lib/protocol";

type StageStatus = "pending" | "active" | "done" | "blocked" | "failed";

type Stage = {
  id: string;
  label: string;
  detail: string;
  status: StageStatus;
  owner: "source" | "model" | "human" | "qa" | "system";
};

function hasType(events: WorkbenchEvent[], type: string) {
  return events.some((e) => e.type === type);
}

export function buildRunDataStages(state: RunState): Stage[] {
  const events = state.events;
  const reqs = state.requirements as {
    citations?: unknown[];
  }[];
  const withCitation = reqs.filter((r) => (r.citations?.length ?? 0) > 0).length;
  const hitlHuman = events.some((e) =>
    [
      "plan.approved",
      "plan.rejected",
      "tool.args_edited",
      "tool.args_gate_released",
      "gate.approved",
      "gate.rejected",
    ].includes(e.type),
  );

  return [
    {
      id: "source",
      label: "원문·시나리오",
      detail: state.scenarioId
        ? `scenario ${state.scenarioId} · mode ${state.mode ?? "?"}`
        : "실행 전",
      status: state.scenarioId || state.runId ? "done" : "pending",
      owner: "source",
    },
    {
      id: "extract",
      label: "요구 추출",
      detail:
        reqs.length > 0
          ? `${reqs.length} requirements · conflicts ${state.conflicts.length}`
          : hasType(events, "requirements.invalid")
            ? "schema invalid"
            : "대기",
      status: hasType(events, "requirements.invalid")
        ? "failed"
        : reqs.length > 0
          ? "done"
          : state.status === "structuring"
            ? "active"
            : "pending",
      owner: "model",
    },
    {
      id: "citation",
      label: "근거(citation)",
      detail:
        reqs.length === 0
          ? "대기"
          : state.citationMissing || state.approveBlockedReason
            ? state.approveBlockedReason ?? "근거 부족 · 승인 차단"
            : `${withCitation}/${reqs.length} with citation`,
      status:
        reqs.length === 0
          ? "pending"
          : state.citationMissing || state.approveBlockedReason
            ? "blocked"
            : withCitation > 0
              ? "done"
              : "blocked",
      owner: "model",
    },
    {
      id: "hitl",
      label: "사람 검토(HITL)",
      detail: hitlHuman
        ? `audit ${events.filter((e) => ["plan.approved", "plan.rejected", "tool.args_edited", "tool.args_gate_released", "gate.approved", "gate.rejected"].includes(e.type)).length} events`
        : state.status === "awaiting_plan_review" || state.status === "awaiting_gate"
          ? "승인·수정·거절 대기"
          : "대기",
      status: hitlHuman
        ? "done"
        : state.status === "awaiting_plan_review" || state.status === "awaiting_gate"
          ? "active"
          : "pending",
      owner: "human",
    },
    {
      id: "tools",
      label: "도구·변경",
      detail:
        state.tools.length > 0
          ? `${state.tools.length} tools · diffs ${state.diffs.length}`
          : "대기",
      status:
        state.tools.some((t) => t.status === "failed")
          ? "failed"
          : state.tools.length > 0
            ? state.tools.every((t) => t.status === "succeeded" || t.status === "aborted")
              ? "done"
              : "active"
            : "pending",
      owner: "model",
    },
    {
      id: "qa",
      label: "자동 QA",
      detail: state.qa
        ? state.qa.passed
          ? "passed"
          : "failed"
        : "대기",
      status: state.qa ? (state.qa.passed ? "done" : "failed") : "pending",
      owner: "qa",
    },
    {
      id: "gate",
      label: "릴리즈 게이트",
      detail: hasType(events, "gate.approved")
        ? "approved"
        : hasType(events, "gate.rejected")
          ? "rejected"
          : state.gatePending || state.status === "awaiting_gate"
            ? "pending decision"
            : "대기",
      status: hasType(events, "gate.approved")
        ? "done"
        : hasType(events, "gate.rejected")
          ? "failed"
          : state.gatePending || state.status === "awaiting_gate"
            ? "active"
            : "pending",
      owner: "human",
    },
    {
      id: "eval",
      label: "평가 데이터셋",
      detail: hasType(events, "eval.case_recorded")
        ? "case recorded"
        : "실패·거절 시 기록",
      status: hasType(events, "eval.case_recorded") ? "done" : "pending",
      owner: "system",
    },
  ];
}

const statusClass: Record<StageStatus, string> = {
  pending: "border-zinc-800 text-zinc-500",
  active: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  done: "border-emerald-500/30 bg-emerald-500/5 text-emerald-100",
  blocked: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  failed: "border-red-500/40 bg-red-500/10 text-red-100",
};

const ownerLabel: Record<Stage["owner"], string> = {
  source: "source",
  model: "model",
  human: "human",
  qa: "qa",
  system: "system",
};

export function RunDataInspector({ state }: { state: RunState }) {
  const stages = buildRunDataStages(state);
  const empty = !state.runId && state.events.length === 0;

  return (
    <section
      id="data-inspector"
      className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"
      aria-label="Run Data Inspector"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">
            Run Data Inspector
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            누가·언제·어떤 근거로 데이터가 바뀌는지 (사내 GUIDE 원칙의 공개 재현 · 합성
            데이터만)
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          status {state.status}
          {state.runId ? ` · ${state.runId}` : ""}
        </p>
      </div>

      {empty ? (
        <p className="text-sm text-zinc-500">
          실행을 시작하면 원문 → 추출 → 근거 → HITL → 도구 → QA → 게이트 → eval
          단계가 채워집니다.
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-lg border px-3 py-2 ${statusClass[s.status]}`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide opacity-70">
                <span>
                  {i + 1}. {ownerLabel[s.owner]}
                </span>
                <span>{s.status}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{s.label}</p>
              <p className="mt-0.5 text-xs opacity-80">{s.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
