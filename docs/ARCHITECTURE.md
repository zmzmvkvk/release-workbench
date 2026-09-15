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
        │                GET  /workbench/api/health
        │                GET  /workbench/api/protocol  (event/state catalog)
        │                GET  /workbench/api/runs/:id  (KV snapshot · eventTypes · toolNames)
        │                POST /workbench/api/runs/stream
        │                POST /workbench/api/runs/:id/continue
        │                POST /workbench/api/runs/:id/cancel
        │                ├─ mock fixtures (deterministic)
        │                ├─ mode=workers-ai
        │                │     ├─ struct-v3 (requirements + citations)
        │                │     └─ on plan approve: patch-v1 `propose_patch_plan`
        │                │         then deterministic execute fixtures
        │                ├─ KV WORKBENCH_IDEMPOTENCY (duplicate · run resume · args gate)
        │                └─ ASSETS (SPA)
        │
        └─ fallback: client-mock-runner (same event protocol)
```

Public URLs:

- https://roomy.page/workbench/
- https://roomy.page/workbench/api/health
- https://roomy.page/workbench/api/protocol
- https://roomy-page-workbench.hommy.workers.dev/workbench/
- https://github.com/zmzmvkvk/release-workbench

## Event protocol

Canonical types live in `src/lib/protocol.ts` + wiki `concept-workbench-protocol`.

- Envelope: `{ id, runId, seq, ts, type, payload }`
- Mock · Worker SSE · Workers AI share the **same type set**
- Reconnect: ignore `seq <= lastSeq`

## State machine

`idle → structuring → awaiting_plan_review → executing → awaiting_gate → completed|failed|cancelled`

HITL: `plan.rejected`, `tool.args_edited` / `args_continue` (HTTP KV gate after first `tool.started`), `gate.rejected`, cancel, duplicate block
KV: `idem:*` duplicate · `run:*` resume after SSE disconnect (`waitUntil`) · `args:*` cross-isolate tool gate

## Data

| Asset | Path |
| --- | --- |
| Scenarios (32) | `src/data/scenarios.json` |
| Mock bench results | `src/data/eval-results.json` |
| Workers AI spot | `src/data/eval-workers-ai-spot.json` |
| Structuring fixtures | `src/lib/fixtures.ts` |
| Execute fixtures | `src/lib/execute-fixtures.ts` |

## Observability

- `GET /workbench/api/health` — `{ ok, sse, kv, ai, protocol }` (UI header badge)
- `GET /workbench/api/protocol` — states, eventTypes, HITL, promptVersions (curl hiring evidence)
- `GET /workbench/api/runs/:id` — KV/memory snapshot (`mode`, `eventTypes`, `toolNames`)
- `metrics.sample` — ttftMs, totalMs, tokens, costUsd, provider, model, promptVersion
- Workers AI: `usage.total_tokens` 파싱 시 tokens 기록. **costUsd는 provider 미제공 → null** (추정 금지)
- Hybrid execute: `propose_patch_plan` tool (prompt `workers-ai-patch-v1`) before mock fixtures
- HITL/gate 감사 로그 UI + trace JSON 다운로드
- `trace.span` — named intervals (`workers_ai_structuring`, `workers_ai_patch_plan`, …)
- `/evals` dashboard — mock n=32 + Workers AI spot (separate tables; tokens p50 when present)
- CI `prod-smoke` — health + protocol + live Workers AI structuring SSE

## Security

See `docs/SECURITY.md`. Preview uses `iframe sandbox=""`. No company screens or productivity % invented.
