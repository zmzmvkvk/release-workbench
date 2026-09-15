# Architecture

Release Workbench — live flagship for internal-ops AX frontend evidence.

## Goal

**작업 요청 → 사람 검토 → Agent 변경 → 자동 QA → 게이트**  
AI 생성물만 보여주는 데모가 아니라, 불완전 출력의 검토·검증·릴리즈 업무 시스템.

## Runtime (2026-09-15)

```
Browser (React / Next static export, basePath /workbench)
  ├─ WorkbenchApp     시나리오 · 타임라인 · diff · preview · QA · HITL · Workers AI 토글
  └─ applyEvent       Zod WorkbenchEvent → RunState
        │
        ├─ prefer HTTP SSE ─────────────────────────────────────────┐
        │                                                           ▼
        │              Cloudflare Worker `roomy-page-workbench`
        │                POST /workbench/api/runs/stream
        │                POST /workbench/api/runs/:id/continue
        │                POST /workbench/api/runs/:id/cancel
        │                ├─ mock fixtures (deterministic)
        │                ├─ mode=workers-ai → Workers AI llama-3.2-3b
        │                │     + schema fail → heuristic fallback
        │                ├─ KV WORKBENCH_IDEMPOTENCY (duplicate block)
        │                └─ ASSETS (SPA)
        │
        └─ fallback: client-mock-runner (same event protocol)
```

Public URLs:

- https://roomy.page/workbench
- https://roomy-page-workbench.hommy.workers.dev/workbench
- https://github.com/zmzmvkvk/release-workbench

## Event protocol

Canonical types live in `src/lib/protocol.ts` + wiki `concept-workbench-protocol`.

- Envelope: `{ id, runId, seq, ts, type, payload }`
- Mock · Worker SSE · Workers AI share the **same type set**
- Reconnect: ignore `seq <= lastSeq`

## State machine

`idle → structuring → awaiting_plan_review → executing → awaiting_gate → completed|failed|cancelled`

HITL: `plan.rejected`, `tool.args_edited`, `gate.rejected`, cancel, duplicate block

## Data

| Asset | Path |
| --- | --- |
| Scenarios (32) | `src/data/scenarios.json` |
| Mock bench results | `src/data/eval-results.json` |
| Workers AI spot | `src/data/eval-workers-ai-spot.json` |
| Structuring fixtures | `src/lib/fixtures.ts` |
| Execute fixtures | `src/lib/execute-fixtures.ts` |

## Observability

- `metrics.sample` — ttftMs, totalMs, tokens, costUsd, provider, model, promptVersion
- `trace.span` — named intervals
- `/evals` dashboard — mock n=32 + Workers AI spot (separate tables)

## Security

See `docs/SECURITY.md`. Preview uses `iframe sandbox=""`. No company screens or productivity % invented.
