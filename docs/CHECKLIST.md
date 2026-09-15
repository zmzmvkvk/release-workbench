# Deliverables checklist (goal audit)

기준일: 2026-09-15. 증거가 파일/URL로 확인된 것만 ✅.

| # | 산출물 | 상태 | 증거 |
| --- | --- | --- | --- |
| 1 | 라이브 서비스 | ✅ | https://roomy.page/workbench (+ workers.dev) |
| 2 | 공개 GitHub | ✅ | https://github.com/zmzmvkvk/release-workbench |
| 3 | 60–90초 데모 영상 | ✅ | `/workbench/demo/release-workbench-90s.webm` + `docs/DEMO_SCRIPT.md` |
| 4 | 시스템 아키텍처 | ✅ | `docs/ARCHITECTURE.md` |
| 5 | 이벤트·상태머신 문서 | ✅ | `docs/PROTOCOL.md` + wiki protocol |
| 6 | 평가 데이터셋 30+ · 결과표 | ✅ | scenarios 32 + `/evals` + `pnpm bench` |
| 7 | Playwright · Vitest CI | ✅ | e2e + vitest + `.github/workflows/workbench-ci.yml` |
| 8 | 실패 사례 보고서 | ✅ | `docs/FAILURE_CASES.md` |
| 9 | 보안·공개범위 | ✅ | `docs/SECURITY.md` |
| 10 | 케이스스터디 | ✅ | wiki `concept-case-release-workbench` |

## 필수 기능

| 기능 | 상태 |
| --- | --- |
| deterministic mock | ✅ client mock |
| HTTP SSE (mock on Worker) | ✅ same-origin on roomy.page |
| 도구 호출 UI | ✅ |
| 승인·수정·거절 | ✅ plan/gate (인자 수정은 fixture) |
| 실패 복구 시연 | ✅ fixtures + E2E + Worker MAX_STEPS 등 |
| 미리보기 | ✅ sandboxed iframe |
| 자동 QA | ✅ mock report + axe E2E |
| trace · metrics | ✅ events + bench TTFT |
| 평가 대시보드 | ✅ `/evals` |
| 실 LLM 연동 | ✅ Workers AI `@cf/meta/llama-3.2-3b-instruct` (`mode=workers-ai`) · 스키마 실패 시 휴리스틱 폴백 |
| roomy.page 커스텀 도메인 | ✅ 200 검증 (2026-09-15) |

## 실패 10종

| 시연 | fixture/E2E |
| --- | --- |
| 취소 | rw-005 + E2E |
| 재연결 | rw-006 + Worker `network_resume` |
| 잘못된 구조화 | rw-007 + E2E |
| 도구 실패·재시도 | rw-008 + Worker `tool_fail_retry` |
| 중복 차단 | rw-011 + E2E + Worker KV `WORKBENCH_IDEMPOTENCY` |
| 근거 없음 | rw-012 + E2E |
| HTML 격리 | rw-013 + Worker `unsafe_html_isolated` |
| 단계 초과 | rw-014 + Worker `max_steps_exceeded` |
| 승인 거절 | rw-009 + E2E |
| 인자 수정 | rw-010 + HITL UI `인자 수정 적용` + E2E |

목표 완료로 보지 않음: OpenAI/Anthropic 키 경로 고도화, FDE용 BE/DB·인증, Workers AI 대량 벤치 표본은 이후. KV idempotency·HITL 인자 수정 UI는 반영됨.
