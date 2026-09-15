# Hiring brief — Release Workbench

내부업무 AX / AX 프론트엔드 채용 검토용 1페이지.

## 한 줄

AI가 페이지를 만드는 데모가 아니라, **불완전 출력을 검토·자동 QA·게이트로 안전하게 릴리즈하는 업무 시스템**입니다.

## 바로 확인

| 증거 | URL |
| --- | --- |
| 라이브 | https://roomy.page/workbench/ |
| Worker health | https://roomy.page/workbench/api/health |
| Eval summary (curl) | https://roomy.page/workbench/api/evals |
| Event protocol (curl) | https://roomy.page/workbench/api/protocol |
| Run snapshot (KV) | `GET /workbench/api/runs/:id` (mode · eventTypes) |
| CI (unit/e2e + prod health/AI smoke) | https://github.com/zmzmvkvk/release-workbench/actions |
| 90초 데모 | https://roomy.page/workbench/demo/release-workbench-90s.webm |
| QA 실패→거절→eval (자동실행) | https://roomy.page/workbench/?mock=1&scenario=rw-027&filter=failure&autorun=1 |
| Workers AI 하이브리드 | https://roomy.page/workbench/?mode=workers-ai&scenario=rw-004 |
| 실패 매트릭스 | https://roomy.page/workbench/evals#failures |
| 합성 벤치 (n=35 · fixtureCoverage 26 · Workers AI spot) | https://roomy.page/workbench/evals |
| 소스 | https://github.com/zmzmvkvk/release-workbench |

> roomy.page에서는 `/workbench/?…` 처럼 **trailing slash** 를 쓰세요 (`/workbench?…` 는 522 가능).

## 공고와 맞추는 점

- 반복 업무 흐름을 UI로 구조화 (계획 → HITL → 도구 → QA → 게이트)
- SSE 스트리밍 · Worker health(`sse+kv+ai`) · 취소 · 재연결 · 중복 실행 차단
- 도구 인자 수정 / 수정 없이 계속 (HTTP KV, isolate-safe)
- 근거(citation) 없으면 승인 차단
- 실패를 평가 데이터셋에 기록 (`eval.case_recorded`)
- 관찰성: TTFT · tokens(있을 때) · cancel latency · reconnect · 감사 로그 · trace JSON
- Workers AI **costUsd**는 provider 미제공 → null (추정 안 함)

## 하지 않는 주장

- 회사 생산성 % / 사내 화면 / 실사용자 수치
- Workers AI **cost** 추정 (tokens는 usage 파싱 시 공개, cost는 null)

## 상세

`docs/CASE_STUDY.md` · `docs/ARCHITECTURE.md` · `docs/PROTOCOL.md` · `docs/FAILURE_CASES.md`
