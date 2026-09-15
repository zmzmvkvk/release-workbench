# Deliverables checklist (goal audit)

기준일: 2026-09-15. 증거가 URL/CI/파일로 확인된 것만 ✅.

| # | 산출물 | 상태 | 증거 |
| --- | --- | --- | --- |
| 1 | 라이브 서비스 | ✅ | https://roomy.page/workbench |
| 2 | 공개 GitHub | ✅ | https://github.com/zmzmvkvk/release-workbench |
| 3 | 60–90초 데모 | ✅ | https://roomy.page/workbench/demo/release-workbench-90s.webm · `docs/DEMO_SCRIPT.md` |
| 4 | 시스템 아키텍처 | ✅ | `docs/ARCHITECTURE.md` |
| 5 | 이벤트·상태머신 | ✅ | `docs/PROTOCOL.md` |
| 6 | 평가 30+ · 결과표 | ✅ | scenarios 32 · `/evals` · mock + Workers AI spot v3 |
| 7 | Playwright · Vitest CI | ✅ | https://github.com/zmzmvkvk/release-workbench/actions |
| 8 | 실패 사례 보고서 | ✅ | `docs/FAILURE_CASES.md` (E2E 매핑) |
| 9 | 보안·공개범위 | ✅ | `docs/SECURITY.md` |
| 10 | 케이스스터디 | ✅ | `docs/CASE_STUDY.md` · wiki `concept-case-release-workbench` |

## 필수 기능

| 기능 | 상태 |
| --- | --- |
| deterministic mock | ✅ |
| HTTP SSE (Worker) | ✅ roomy.page same-origin |
| Workers AI 구조화 | ✅ `mode=workers-ai` · prompt v3 · source-bound citations |
| 도구 호출 UI | ✅ |
| 승인·수정·거절 | ✅ plan / gate / **인자 수정·수정 없이 계속** |
| 실패 복구 시연 | ✅ 10종 + E2E |
| 미리보기 | ✅ sandboxed iframe |
| 자동 QA | ✅ mock + axe E2E |
| trace · metrics | ✅ + TTFT/workflow/cancel/a11y/tool-retry |
| 평가 대시보드 | ✅ `/evals` |
| KV idempotency | ✅ |

## 실패 10종

| 시연 | 증거 |
| --- | --- |
| 취소 | rw-005 E2E |
| 재연결 | rw-006 E2E |
| 잘못된 구조화 | rw-007 E2E |
| 도구 실패·재시도 | rw-008 E2E |
| 승인 거절 | rw-009 E2E |
| 인자 수정 | HITL UI + E2E |
| 중복 차단 | rw-011 E2E + KV |
| 근거 없음 | rw-012 E2E |
| HTML 격리 | rw-013 E2E |
| 단계 초과 | rw-014 E2E |

## 아직 목표 밖 / 이후

- OpenAI/Anthropic 키 경로 고도화
- FDE용 BE/DB·인증·Docker
- Workers AI 대량 벤치·token/cost 계측
- 사내 자동화는 공개 화면·수치 없이 설계 원칙만 (`docs/CASE_INTERNAL_AUTOMATION.md`)
