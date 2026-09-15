# Demo script (60–90초)

녹화 대상: https://roomy.page/workbench  
(대체) https://roomy-page-workbench.hommy.workers.dev/workbench  

성공만 찍지 말고 **실패 한 컷**을 넣는다. 현재 산출물: `public/demo/release-workbench-90s.webm`

## 타임라인

| 초 | 화면 | 말할 것 |
| --- | --- | --- |
| 0–8 | 히어로 + 시나리오 목록 | “내부업무 AX용 릴리즈 워크벤치. AI 생성이 아니라 검토·검증·게이트.” |
| 8–18 | rw-004 → 실행 (mock SSE) | “요구사항 구조화와 원문 근거. HTTP SSE로 상태가 흐릅니다.” |
| 18–32 | 계획 승인 → 인자 수정(선택) → diff · preview · QA | “승인 후에야 패치·미리보기·자동 QA. 도구 인자는 사람이 고칠 수 있습니다.” |
| 32–42 | 게이트 승인 | “사람이 최종 릴리즈를 결정합니다.” |
| 42–58 | rw-012 또는 rw-005 / rw-011 | “근거 없으면 승인 불가 / 취소 / 중복 실행 차단.” |
| 58–72 | Workers AI 토글(선택 1컷) | “같은 프로토콜로 Workers AI 구조화도 됩니다. 스키마 깨지면 폴백·HITL.” |
| 72–85 | /evals | “합성 32 + Workers AI spot. 표본·모델·프롬프트·TTFT를 같이 공개.” |
| 85–90 | URL | roomy.page/workbench · GitHub release-workbench |

## 찍지 말 것

- 사내 화면, 회사 생산성 %
- API 키 입력 장면
- “ChatGPT로 만들었습니다” 멘트

## 재녹화 명령

```bash
pnpm demo:record
```
