# Architecture

Release Workbench — `portfolio/workbench`

## 목표

내부업무 AX FE 채용 증거: **작업 요청 → 사람 검토 → Agent 변경 → 자동 QA → 게이트**.

## 구성

```
Browser (React)
  ├─ WorkbenchApp          시나리오·원문·타임라인·diff·preview·QA·게이트
  └─ applyEvent reducer    Zod WorkbenchEvent → RunState
        │
        ▼
Next.js Route Handlers
  POST /api/runs/stream              structuring SSE (mock fixtures)
  POST /api/runs/:id/cancel          abort + run.cancelled
  POST /api/runs/:id/continue        plan approve → execute SSE
                                     reject / gate_* → JSON events
        │
        ▼
In-memory run-store (dev/demo)
  ActiveRun { events, abort, idempotencyKey }
```

## 이벤트 프로토콜

정본: `portfolio/docs/wiki/concepts/concept-workbench-protocol.md`

- Envelope: `{ id, runId, seq, ts, type, payload }`
- Mock과 live는 **동일 type 집합**
- Reconnect: `seq` 단조 → 클라이언트는 `seq <= lastSeq` 무시

## 상태 머신 (요약)

`idle → structuring → awaiting_plan_review → executing → awaiting_gate → completed|failed|cancelled`

HITL 분기: `plan.rejected`, `gate.rejected`, `gate.edit_requested`

## 데이터

- 합성 시나리오: `src/data/scenarios.json` (연구본과 동기: `docs/research/release-workbench/`)
- Fixture 시퀀스: `src/lib/fixtures.ts`, execute: `src/lib/execute-fixtures.ts`

## 배포 모드

- **Client mock (현재 라이브)**: 브라우저 fixture 재생.  
  https://roomy-page-workbench.hommy.workers.dev/workbench
- Cloudflare Worker `roomy-page-workbench`, `basePath: /workbench`
- Node SSE 참고: `node-server/api-reference/`

## 관찰성

- `trace.span`, `metrics.sample` 이벤트
- 이후 Langfuse/OTel exporter (5주)
