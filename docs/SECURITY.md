# Security & disclosure scope

공개 데모 범위. 회사 비밀·사내 화면·실사용자 데이터 없음.

## 공개해도 되는 것

- 합성 시나리오 텍스트 (교육·유통 **가상** 업무)
- mock SSE 이벤트·상태머신·평가 레이블
- 클린룸 React diff / sandboxed preview HTML
- 합성 벤치마크 숫자 (표본·모델·프롬프트 버전과 함께)

## 공개하지 않는 것

- 메가스터디·롯데 등 **사내 화면·로그·수치**
- 실제 API 키, 고객 PII
- 내부 자동화 도구의 비공개 URL

사내 자동화는 포트폴리오에서 **두 번째 케이스**로만: 설계 원칙 서술 + 이 공개 데모와의 차이.

## 데모 보안 통제

| 위험 | 통제 |
| --- | --- |
| 모델/원문 HTML XSS | **DOMPurify** (`sanitizePreviewHtml`) + `iframe sandbox=""` + `preview.sanitized` 이벤트 |
| 임의 코드 실행 | mock 단계에서는 패치 문자열만 표시. 실실행 시 분리 sandbox(이후) |
| 중복 side effect | `idempotencyKey` → `run.duplicate_blocked` |
| 동시 스트림 과부하 | per-isolate `maxActiveStreams: 8` → HTTP 429 + `Retry-After` |
| 근거 없는 생성 | citation 없으면 계획 승인 비활성 |
| 과도한 변경 | `run.step_limit` |
| 스트리밍 중단 | cancel → AbortSignal |

## URL 주의 (roomy.page)

커스텀 도메인에서 **슬래시 없는 경로 + 쿼리** (`/workbench?mock=1`, `/portfolio?x=1`)는 Cloudflare 522가 날 수 있다.
공개 링크는 항상 trailing slash를 쓴다: `/workbench/?mock=1&scenario=rw-027`.

## 권한 (목표 모델, 5–6주)

- 데모: 인증 없음 (공개 mock)
- 제품형: 세션 사용자 · run 소유 · audit log (`gate.*`, `plan.*`)

## 라이선스·의존성

- Next.js / React — MIT
- 시나리오·문서 — 저장소 라이선스에 따름
