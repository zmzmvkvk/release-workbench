# Failure cases (demo inventory)

시연용 실패·복구. 성공 영상만 두지 않는다.

| ID | Fixture | 기대 신호 | 자동화 |
| --- | --- | --- | --- |
| rw-005 | cancel_during_structuring | `run.cancelled` | E2E |
| rw-006 | stream_reconnect | `stream.reconnect` + banner | E2E |
| (live) | HTTP SSE drop mid-stream | `GET /api/runs/:id` snapshot → `stream.reconnect` (`recoveredFrom: run-snapshot`) | client `http-sse` + Vitest |
| rw-007 | invalid_requirements_json | `requirements.invalid` → `failed` | E2E |
| rw-008 | tool_retry_once | `tool.failed` → `tool.retried` | E2E |
| rw-009 | plan_reject_darkmode | `plan.rejected` / `rejected_at_plan` | E2E |
| rw-010 | tool_args_edited | `tool.args_edited` + HITL UI | E2E (rw-004·rw-034) |
| rw-011 | duplicate_blocked | `run.duplicate_blocked` | E2E + Worker KV · rw-035 |
| rw-012 | citation_missing_block | 승인 버튼 비활성 | E2E |
| rw-013 | preview_xss_sanitized | sanitized note + sandbox iframe + DOMPurify | E2E |
| rw-014 | step_limit_exceeded | `run.step_limit` → `failed` | E2E |
| rw-027 | qa_playwright_mismatch | QA 실패 + 수정 제안 | E2E |
| rw-001 | conflict_discount_copy | 충돌 → 승인 차단 | fixture + bench · rw-033 |
| 동시 스트림 과부하 | health `maxActiveStreams` · HTTP 429 · 클라이언트 1회 자동 재시도 |
| gate reject | (rw-027 등) | `gate.rejected` + `eval.case_recorded` | E2E |

정상 경로: rw-004 → 계획 승인 → (**수정 없이 계속** 또는 인자 수정) → execute → QA → 게이트 승인.

Workers AI 하이브리드: `mode=workers-ai` 구조화(struct-v3) → 계획 승인 → 라이브 `propose_patch_plan`(patch-v1) → deterministic execute fixture. 모델이 버전·의존성을 지어내면 프롬프트 제약 + HITL 게이트가 방어선이다(추정 cost 없음).

HTTP SSE (라이브): execute 첫 `tool.started`에서 Worker가 일시정지 → `POST …/continue` `args_continue`/`args_edit`(KV 신호, isolate-safe) → soft-timeout 12s.

측정 시 표본·fixture 버전·실행 횟수·모델·프롬프트 버전을 `/evals`와 README에 같이 적는다.
