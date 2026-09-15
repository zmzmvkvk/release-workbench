# Event & state machine

정본(전략 위키): `../../docs/wiki/concepts/concept-workbench-protocol.md`

## Run 상태

`idle → structuring → awaiting_plan_review → executing → awaiting_gate → completed|failed|cancelled`

터미널: `completed`, `cancelled`, `rejected_at_plan`, `failed`

## HITL

| 액션 | 이벤트 |
| --- | --- |
| 계획 승인 | `plan.approved` → execute mock |
| 계획 거절 | `plan.rejected` |
| 게이트 승인 | `gate.approved` + `run.completed` |
| 게이트 거절 | `gate.rejected` + `eval.case_recorded` |
| 취소 | `run.cancelled` |

## 배포 모드

- **Client mock (현재 라이브)**: 브라우저에서 fixture 시퀀스 재생. API 키·Node SSE 불필요.
- **Node SSE (참고)**: `node-server/api-reference/` — live LLM 이식용.

프론트 리듀서 `applyEvent`는 두 모드 동일 프로토콜을 소비한다.
