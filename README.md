# Release Workbench

**?? ?? ? ??? ???** ? ???? AX / AX ????? ?? ??? ?? ????.

AI? ???? ???? ??? ???, ??? ??? **?? · ?? QA · ???? ???**?? ?? ??????.

## Live evidence

| ?? | URL |
| --- | --- |
| App | https://roomy.page/workbench/ |
| Evals | https://roomy.page/workbench/evals |
| 90s demo | https://roomy.page/workbench/demo/release-workbench-90s.webm |
| Failure deep link | https://roomy.page/workbench/?mock=1&scenario=rw-027&filter=failure |
| workers.dev | https://roomy-page-workbench.hommy.workers.dev/workbench/ |
| CI | [GitHub Actions](https://github.com/zmzmvkvk/release-workbench/actions) |
| Case study | [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) |
| Internal automation (2nd case) | [`docs/CASE_INTERNAL_AUTOMATION.md`](./docs/CASE_INTERNAL_AUTOMATION.md) |

> roomy.page?? ??? ?? ` /workbench?? ` ? 522? ? ? ?? ? ?? `/workbench/??` ??.

Transport: **HTTP SSE** (Cloudflare Worker) + **client mock** fallback. Same event protocol. Optional **Workers AI** structuring (`mode=workers-ai`, prompt `workers-ai-struct-v3`).

HITL: plan approve/reject, **tool args edit / continue** (client-mock + HTTP Worker `args_continue`/`args_edit` gate), release gate.

## What hiring managers can verify

1. SSE streaming + cancel  
2. Tool call timeline + fail/retry  
3. HITL: plan approve/reject, tool arg edit/continue, gate  
4. Failure demos: schema invalid, citation block, duplicate (KV), XSS sandbox, step limit, reconnect, QA fail ? gate reject ? eval  
5. Synthetic evals n=32 (mock) + Workers AI spot (separate table, source-bound citations)  
6. Playwright · Vitest · axe in CI  

## Stack

Next.js (static export) · React · TypeScript · Zod · Playwright · Vitest · Cloudflare Workers · Workers AI · KV idempotency

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000/workbench/
pnpm test
pnpm test:e2e
pnpm bench
pnpm run deploy
```

## Docs

| Doc | Path |
| --- | --- |
| Architecture | `docs/ARCHITECTURE.md` |
| Protocol / state machine | `docs/PROTOCOL.md` |
| Failure cases | `docs/FAILURE_CASES.md` |
| Security | `docs/SECURITY.md` |
| Demo script | `docs/DEMO_SCRIPT.md` |
| Checklist | `docs/CHECKLIST.md` |
