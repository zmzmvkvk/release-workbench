"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  applyEvent,
  initialRunState,
  type RunState,
  type WorkbenchEvent,
} from "@/lib/protocol";
import { scenarioDefaultFixture, type FixtureId } from "@/lib/fixtures";
import {
  createClientRun,
  emitClientEvent,
  runExecuteMock,
  runStructuringMock,
  type ClientRun,
} from "@/lib/client-mock-runner";
import {
  tryHttpCancel,
  tryHttpContinue,
  tryHttpStructuring,
} from "@/lib/http-sse";
import scenariosData from "@/data/scenarios.json";

type Scenario = (typeof scenariosData.scenarios)[number];

function PreviewFrame({ html, label }: { html: string | null; label: string }) {
  if (!html) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-zinc-700 text-xs text-zinc-500">
        {label}: 없음
      </div>
    );
  }
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"/><base target="_blank"/><style>body{margin:0;background:#111;color:#eee}</style></head><body>${html}</body></html>`;
  return (
    <div>
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <iframe
        title={label}
        sandbox=""
        srcDoc={srcDoc}
        className="h-48 w-full rounded-md border border-zinc-800 bg-black"
      />
    </div>
  );
}

export function WorkbenchApp() {
  const scenarios = scenariosData.scenarios as Scenario[];
  const [selectedId, setSelectedId] = useState("rw-004");
  const selected = useMemo(
    () => scenarios.find((s) => s.id === selectedId) ?? scenarios[0],
    [scenarios, selectedId],
  );
  const fixture =
    (selected.fixture as FixtureId) ?? scenarioDefaultFixture(selected.id);

  const [state, setState] = useState<RunState>(initialRunState);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "failure" | "happy">("all");
  const abortRef = useRef<AbortController | null>(null);
  const clientRunRef = useRef<ClientRun | null>(null);
  const httpRunIdRef = useRef<string | null>(null);
  const [transport, setTransport] = useState<"http-sse" | "client-mock">("client-mock");
  const [llmMode, setLlmMode] = useState<"mock" | "workers-ai">("mock");
  const [toolArgsDraft, setToolArgsDraft] = useState("");

  const visible = useMemo(() => {
    return scenarios.filter((s) => {
      if (filter === "all") return true;
      const isFailure =
        (s.failureFocus?.length ?? 0) > 0 || s.tags?.includes("failure");
      return filter === "failure" ? isFailure : !isFailure;
    });
  }, [scenarios, filter]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function push(event: WorkbenchEvent) {
    setState((s) => applyEvent(s, event));
    if (event.type === "stream.reconnect") setBanner("연결 재개됨 (seq 연속)");
    if (event.type === "run.duplicate_blocked") {
      setBanner("동일 idempotencyKey 실행이 이미 진행 중");
    }
    if (event.type === "tool.started") {
      const payload = event.payload as { args?: unknown };
      try {
        setToolArgsDraft(JSON.stringify(payload.args ?? {}, null, 2));
      } catch {
        setToolArgsDraft("{}");
      }
    }
  }

  function applyToolArgsEdit() {
    const run = clientRunRef.current;
    const pending = state.tools.find((t) => t.status === "running");
    if (!pending) {
      setBanner("실행 중인 도구가 없습니다");
      return;
    }
    let args: unknown;
    try {
      args = JSON.parse(toolArgsDraft);
    } catch {
      setBanner("인자 JSON이 올바르지 않습니다");
      return;
    }
    if (run) {
      emitClientEvent(
        run,
        "tool.args_edited",
        { callId: pending.callId, args },
        push,
      );
      setBanner(`도구 인자 수정: ${pending.callId}`);
      return;
    }
    // HTTP path: local UI evidence + timeline event
    push({
      id: `evt_local_args_${Date.now().toString(36)}`,
      runId: state.runId ?? "local",
      seq: state.timeline.length,
      ts: new Date().toISOString(),
      type: "tool.args_edited",
      payload: { callId: pending.callId, args },
    });
    setBanner(`도구 인자 수정(로컬): ${pending.callId}`);
  }

  async function startRun() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    httpRunIdRef.current = null;
    clientRunRef.current = null;
    setState(initialRunState());
    setBanner(null);
    setBusy(true);
    try {
      const usedHttp = await tryHttpStructuring({
        scenarioId: selected.id,
        fixture,
        idempotencyKey: `${selected.id}-${Date.now()}`,
        mode: llmMode,
        sourceText: selected.sources
          ?.map((s: { kind?: string; text?: string }) => `[${s.kind}] ${s.text}`)
          .join("\n\n"),
        signal: ac.signal,
        onEvent: push,
        onRunId: (id) => {
          httpRunIdRef.current = id;
        },
      });
      if (usedHttp) {
        setTransport("http-sse");
        return;
      }
      setTransport("client-mock");
      const run = createClientRun();
      clientRunRef.current = run;
      await runStructuringMock({
        run,
        scenarioId: selected.id,
        fixture,
        idempotencyKey: `${selected.id}-${Date.now()}`,
        onEvent: push,
        signal: ac.signal,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setBanner(`run error: ${(e as Error).message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelRun() {
    const httpId = httpRunIdRef.current;
    if (httpId) {
      const event = await tryHttpCancel(httpId);
      if (event) {
        push(event);
        return;
      }
    }
    const run = clientRunRef.current;
    if (!run) return;
    run.cancelled = true;
    abortRef.current?.abort();
    if (busy) return;
    setState((s) => {
      if (
        s.status === "cancelled" ||
        s.status === "completed" ||
        s.status === "failed" ||
        s.status === "rejected_at_plan"
      ) {
        return s;
      }
      return applyEvent(s, {
        id: `evt_${run.runId}_${run.seq}`,
        runId: run.runId,
        seq: run.seq++,
        ts: new Date().toISOString(),
        type: "run.cancelled",
        payload: { reason: "user_cancelled" },
      });
    });
  }

  async function continueAction(
    action: "approve" | "reject" | "gate_approve" | "gate_reject" | "gate_edit",
  ) {
    const httpId = httpRunIdRef.current;
    if (httpId) {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      try {
        const mode = await tryHttpContinue({
          runId: httpId,
          action,
          signal: ac.signal,
          onEvent: push,
        });
        if (mode !== "none") return;
      } finally {
        setBusy(false);
      }
    }

    const run = clientRunRef.current;
    if (!run) {
      setBanner("run 없음 — 먼저 실행하세요");
      return;
    }

    if (action === "reject") {
      emitClientEvent(run, "plan.rejected", { reason: "user_rejected" }, push);
      return;
    }
    if (action === "gate_approve") {
      emitClientEvent(run, "gate.approved", { by: "user" }, push);
      emitClientEvent(run, "run.completed", { summary: "released" }, push);
      return;
    }
    if (action === "gate_reject") {
      emitClientEvent(
        run,
        "gate.rejected",
        { reason: "user_rejected_at_gate" },
        push,
      );
      emitClientEvent(
        run,
        "eval.case_recorded",
        { caseId: selected.id, outcome: "gate_rejected" },
        push,
      );
      return;
    }
    if (action === "gate_edit") {
      emitClientEvent(
        run,
        "gate.edit_requested",
        { notes: "needs edits" },
        push,
      );
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    try {
      await runExecuteMock({
        run,
        scenarioId: selected.id,
        onEvent: push,
        signal: ac.signal,
      });
    } finally {
      setBusy(false);
    }
  }

  const canCancel =
    state.status === "structuring" ||
    state.status === "executing" ||
    state.status === "awaiting_plan_review";
  const canReviewPlan = state.status === "awaiting_plan_review";
  const canGate = state.status === "awaiting_gate" || state.gatePending;
  const approveDisabled = Boolean(state.approveBlockedReason);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2 border-b border-zinc-800 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Release Workbench · {transport} · {scenariosData.meta.count} scenarios
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          작업 요청 → 검증된 릴리즈
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          합성 시나리오를 고르고, deterministic mock으로 구조화 → 승인 →
          도구/diff/미리보기/QA → 게이트까지 실패 복구를 시연합니다.{" "}
          <Link href="/evals" className="text-emerald-400 hover:underline">
            평가 대시보드
          </Link>
          {" · "}
          <a
            href="/workbench/demo/release-workbench-90s.webm"
            className="text-emerald-400 hover:underline"
          >
            90초 데모
          </a>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">구조화 모드</span>
        {(["mock", "workers-ai"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setLlmMode(m)}
            className={`rounded-md border px-2 py-1 ${
              llmMode === m
                ? "border-sky-500/50 text-sky-100"
                : "border-zinc-800 text-zinc-400"
            }`}
          >
            {m === "mock" ? "deterministic mock" : "Workers AI (llama-3.2-3b)"}
          </button>
        ))}
        <span className="text-zinc-600">
          · transport {transport} · mode {llmMode}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["all", "failure", "happy"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-2 py-1 ${
              filter === f
                ? "border-emerald-500/50 text-emerald-100"
                : "border-zinc-800 text-zinc-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              selectedId === s.id
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="block font-medium">{s.title}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {s.id} · {s.fixture}
            </span>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-200">원문 자료</h2>
        <ul className="space-y-2">
          {selected.sources.map((src, i) => (
            <li
              key={i}
              className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
            >
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                {src.kind}
              </span>
              <p className="mt-1 whitespace-pre-wrap text-zinc-300">{src.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => startRun()}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          실행 시작
        </button>
        <button
          type="button"
          disabled={!canCancel}
          onClick={() => cancelRun()}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-40"
        >
          취소
        </button>
        <button
          type="button"
          disabled={!canReviewPlan || approveDisabled}
          onClick={() => continueAction("approve")}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
        >
          계획 승인 → 실행
        </button>
        <button
          type="button"
          disabled={!canReviewPlan}
          onClick={() => continueAction("reject")}
          className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
        >
          계획 거절
        </button>
        <button
          type="button"
          disabled={!canGate}
          onClick={() => continueAction("gate_approve")}
          className="rounded-md border border-emerald-500/40 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
        >
          게이트 승인
        </button>
        <button
          type="button"
          disabled={!canGate}
          onClick={() => continueAction("gate_reject")}
          className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-200 disabled:opacity-40"
        >
          게이트 거절
        </button>
        <span className="text-xs text-zinc-500">
          status: <span className="text-zinc-200">{state.status}</span>
          {state.runId ? ` · ${state.runId}` : ""}
        </span>
      </div>

      {state.approveBlockedReason ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {state.approveBlockedReason}
        </div>
      ) : null}
      {banner ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {state.error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Agent 실행 타임라인">
          <ol className="max-h-80 space-y-2 overflow-y-auto">
            {state.timeline.length === 0 ? (
              <li className="text-sm text-zinc-500">
                실행을 시작하면 이벤트가 스트리밍됩니다.
              </li>
            ) : (
              state.timeline.map((item) => (
                <li
                  key={`${item.seq}-${item.type}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    item.level === "error"
                      ? "border-red-500/30 bg-red-500/5 text-red-100"
                      : item.level === "warn"
                        ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
                        : item.level === "success"
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-300"
                  }`}
                >
                  <div className="flex justify-between gap-2 text-xs opacity-70">
                    <span>#{item.seq}</span>
                    <span>{item.type}</span>
                  </div>
                  <p className="mt-1">{item.summary}</p>
                </li>
              ))
            )}
          </ol>
        </Panel>

        <Panel title="요구사항 · 충돌 · 계획">
          {state.requirements.length === 0 ? (
            <p className="text-sm text-zinc-500">아직 없음</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-300">
              {(
                state.requirements as {
                  id?: string;
                  text?: string;
                  priority?: string;
                  citations?: { quote: string }[];
                }[]
              ).map((r, i) => (
                <li key={r.id ?? i} className="border-b border-zinc-800 pb-2">
                  <span className="text-xs text-zinc-500">{r.priority}</span>
                  <p>{r.text}</p>
                  {r.citations?.[0] ? (
                    <p className="mt-1 text-xs text-emerald-400/80">
                      근거: “{r.citations[0].quote}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {state.conflicts.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-sm text-amber-100">
              충돌 {state.conflicts.length}건
            </div>
          ) : null}
          {state.planSteps.length > 0 ? (
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-zinc-400">
              {state.planSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel title="도구 호출">
          {state.tools.length === 0 ? (
            <p className="text-sm text-zinc-500">없음</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {state.tools.map((t) => (
                <li key={t.callId} className="rounded-md border border-zinc-800 p-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-200">{t.name}</span>
                    <span className="text-xs text-zinc-500">{t.status}</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                    {JSON.stringify(t.args, null, 0)}
                  </pre>
                  {t.error ? <p className="text-xs text-red-300">{t.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
          {state.tools.some((t) => t.status === "running") ? (
            <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-500">승인 전 인자 수정 (HITL)</p>
              <textarea
                aria-label="도구 인자 JSON"
                value={toolArgsDraft}
                onChange={(e) => setToolArgsDraft(e.target.value)}
                className="h-24 w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-200"
              />
              <button
                type="button"
                onClick={() => applyToolArgsEdit()}
                className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100"
              >
                인자 수정 적용
              </button>
            </div>
          ) : null}
        </Panel>

        <Panel title="코드 diff">
          {state.diffs.length === 0 ? (
            <p className="text-sm text-zinc-500">승인 후 생성됩니다</p>
          ) : (
            <ul className="space-y-3">
              {state.diffs.map((f) => (
                <li key={f.path}>
                  <p className="text-xs text-zinc-400">
                    {f.path}{" "}
                    <span className="text-emerald-400">+{f.additions}</span>{" "}
                    <span className="text-red-400">-{f.deletions}</span>
                  </p>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-300">
                    {f.patch}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="반응형 미리보기 (sandboxed)">
          {state.preview.sanitized.length > 0 ? (
            <p className="mb-2 text-xs text-amber-200">
              sanitized: {state.preview.sanitized.join(", ")}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewFrame html={state.preview.desktopHtml} label="Desktop" />
            <PreviewFrame html={state.preview.mobileHtml} label="Mobile" />
          </div>
        </Panel>

        <Panel title="자동 QA · 게이트 · trace">
          {state.qa ? (
            <div className="space-y-2 text-sm">
              <p className={state.qa.passed ? "text-emerald-300" : "text-red-300"}>
                QA {state.qa.passed ? "통과" : "실패"}
              </p>
              <ul className="space-y-1 text-zinc-400">
                {state.qa.suites.map((s) => (
                  <li key={s.name}>
                    {s.passed ? "✓" : "✗"} {s.name}: {s.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">QA 대기</p>
          )}
          {state.metrics ? (
            <p className="mt-3 text-xs text-zinc-500">
              TTFT {state.metrics.ttftMs ?? "—"}ms · tokens {state.metrics.tokens ?? "—"} ·
              cost ${state.metrics.costUsd ?? 0}
            </p>
          ) : null}
          {state.traces.length > 0 ? (
            <ul className="mt-2 text-xs text-zinc-500">
              {state.traces.map((t, i) => (
                <li key={`${t.name}-${i}`}>
                  span {t.name}: {t.end - t.start}ms
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-200">{title}</h2>
      {children}
    </div>
  );
}
