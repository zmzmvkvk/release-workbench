# Failure cases (demo inventory)

시연용 실패·복구. 성공 영상만 두지 않는다.

| ID | Fixture | 기대 신호 |
| --- | --- | --- |
| rw-005 | cancel_during_structuring | `run.cancelled` |
| rw-006 | stream_reconnect | `stream.reconnect` |
| rw-007 | invalid_requirements_json | `requirements.invalid` → `failed` |
| rw-008 | tool_retry_once | `tool.failed` → `tool.retried` |
| rw-009 | plan_reject_darkmode | `plan.rejected` |
| rw-010 | tool_args_edited | `tool.args_edited` |
| rw-011 | duplicate_blocked | `run.duplicate_blocked` |
| rw-012 | citation_missing_block | 승인 버튼 비활성 |
| rw-013 | preview_xss_sanitized | `preview.sanitized` + sandbox iframe |
| rw-014 | step_limit_exceeded | `run.step_limit` |
| rw-001 | conflict_discount_copy | 충돌 → 승인 차단 |

정상 경로: rw-004 → 계획 승인 → execute → QA → 게이트 승인.

측정 시 표본·fixture 버전·실행 횟수를 README/평가표에 같이 적는다.
