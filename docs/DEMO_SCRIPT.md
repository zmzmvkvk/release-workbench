# Demo script (60–90초)

녹화 대상: https://roomy.page/workbench  
(대체) https://roomy-page-workbench.hommy.workers.dev/workbench  

산출물: `public/demo/release-workbench-90s.webm` (최근 녹화 ≈66s, QA fail→gate reject 포함)

## 타임라인

| 초 | 화면 | 말할 것 |
| --- | --- | --- |
| 0–6 | 히어로 + 시나리오 | “내부업무 AX용 릴리즈 워크벤치. 생성보다 검토·검증·게이트.” |
| 6–16 | rw-004 → 구조화 → 계획 승인 → 인자 HITL → QA → 게이트 승인 | “근거 있는 요구 → 사람이 승인 → 패치·미리보기·자동 QA → 릴리즈.” |
| 16–28 | rw-027 QA 실패 → **게이트 거절** → eval 기록 | “QA가 깨지면 거절하고 실패 사례를 평가 데이터셋에 남깁니다.” |
| 28–40 | rw-012 근거 없음 | “citation 없으면 계획 승인 자체가 막힙니다.” |
| 40–50 | rw-005 취소 | “스트리밍 중 취소와 상태 복구.” |
| 50–58 | rw-011 중복 | “idempotency로 중복 side effect 차단.” |
| 58–75 | /evals | “합성 32 + extraction/toolSelection/conflict. 표본·모델·프롬프트 공개.” |
| 75–90 | URL | roomy.page/workbench · GitHub release-workbench |

## 찍지 말 것

- 사내 화면, 회사 생산성 %
- API 키 입력 장면
- “ChatGPT로 만들었습니다” 멘트

## 재녹화 명령

`demo-record.spec.ts`는 CI와 동일하게 `?mock=1`로 녹화한다 (HITL·QA 실패·거절이 deterministic).
라이브 Workers AI UI는 동일 URL에서 토글 가능.

```bash
pnpm demo:record
```
