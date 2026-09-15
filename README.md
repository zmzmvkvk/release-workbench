# Release Workbench

**작업 요청 → 검증된 릴리즈** — 내부업무 AX / AX 프론트엔드 채용 증거용 플래그십.

AI가 페이지를 “만드는” 데모가 아니라, 불완전한 출력을 **검토 · 자동 QA · 게이트**로 릴리즈하는 업무 시스템입니다.

## Live evidence

| 증거 | URL |
| --- | --- |
| App | https://roomy.page/workbench |
| Evals | https://roomy.page/workbench/evals |
| 90s demo | https://roomy.page/workbench/demo/release-workbench-90s.webm |
| workers.dev | https://roomy-page-workbench.hommy.workers.dev/workbench |
| CI | [GitHub Actions](https://github.com/zmzmvkvk/release-workbench/actions) |

Transport: **HTTP SSE** (Cloudflare Worker) + **client mock** fallback. Same event protocol. Optional **Workers AI** structuring (`mode=workers-ai`).

## What hiring managers can verify

1. SSE streaming + cancel  
2. Tool call timeline + fail/retry  
3. HITL: plan approve/reject, tool arg edit, gate  
4. Failure demos: schema invalid, citation block, duplicate (KV), XSS sandbox, step limit, reconnect  
5. Synthetic evals n=32 (mock) + Workers AI spot sample (separate table)  
6. Playwright · Vitest · axe in CI  

## Stack

Next.js (static export) · React · TypeScript · Zod · Playwright · Vitest · Cloudflare Workers · Workers AI · KV idempotency

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
| Custom domain | `docs/CUSTOM_DOMAIN.md` |

## License

MIT
