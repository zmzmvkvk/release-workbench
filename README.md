# Release Workbench

**작업 요청 → 검증된 릴리즈** — 내부업무 AX 프론트엔드 플래그십.

AI가 페이지를 “만드는” 데모가 아니라, 불완전한 출력을 **검토·자동 QA·게이트**로 릴리즈하는 업무 시스템입니다.

## Live

- App: https://roomy-page-workbench.hommy.workers.dev/workbench  
- (roomy.page 프록시) https://roomy.page/workbench — portfolio Worker가 `/workbench*`를 프록시  
- Evals: https://roomy-page-workbench.hommy.workers.dev/workbench/evals  
- Demo: https://roomy-page-workbench.hommy.workers.dev/workbench/demo/release-workbench-90s.webm  

Transport: **HTTP SSE** (Cloudflare Worker) with **client mock** fallback. Same event protocol.

## Stack

Next.js (static export) · React · TypeScript · Zod · Playwright · Vitest · Cloudflare Workers

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000/workbench
pnpm test
pnpm test:e2e
pnpm bench
pnpm run deploy
```

## Docs

| Doc | Path |
| --- | --- |
| Architecture | `docs/ARCHITECTURE.md` |
| Protocol | `docs/PROTOCOL.md` |
| Security | `docs/SECURITY.md` |
| Failure cases | `docs/FAILURE_CASES.md` |
| Checklist | `docs/CHECKLIST.md` |

## License

MIT
