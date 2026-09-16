# Release Workbench

[![ci](https://github.com/zmzmvkvk/release-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/zmzmvkvk/release-workbench/actions/workflows/ci.yml)

Public **request -> verified release** workbench. Flagship hiring evidence for internal-ops AX / AX frontend roles.

Not an "AI builds a page" demo -- a work system where incomplete model output is **reviewed, auto-QA'd, and gated** before release.

## Live evidence

| Evidence | URL |
| --- | --- |
| App | https://roomy.page/workbench/ |
| Worker health | https://roomy.page/workbench/api/health |
| Eval summary (curl) | https://roomy.page/workbench/api/evals |
| Event protocol (JSON) | https://roomy.page/workbench/api/protocol |
| Evals | https://roomy.page/workbench/evals |
| 90s demo (~63s) | https://roomy.page/workbench/demo/release-workbench-90s.webm |
| Failure deep link | https://roomy.page/workbench/?mock=1&scenario=rw-027&filter=failure&autorun=1 |
| Args soft-timeout | https://roomy.page/workbench/?mock=1&scenario=rw-004&holdArgs=1 (click Start) |
| Data Inspector | https://roomy.page/workbench/#data-inspector |
| Workers AI hybrid | https://roomy.page/workbench/?mode=workers-ai&scenario=rw-004 |
| Failure matrix | https://roomy.page/workbench/evals#failures |
| workers.dev | https://roomy-page-workbench.hommy.workers.dev/workbench/ |
| CI | [GitHub Actions](https://github.com/zmzmvkvk/release-workbench/actions) (unit/e2e + eval gates + prod AI smoke) |
| Case study | [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) |
| Hiring brief (1p) | [`docs/HIRING_BRIEF.md`](./docs/HIRING_BRIEF.md) |
| Internal automation (2nd case) | [`docs/CASE_INTERNAL_AUTOMATION.md`](./docs/CASE_INTERNAL_AUTOMATION.md) |

> On roomy.page always use a **trailing slash**: `/workbench/?...`. Bare `/workbench?...` can 522.

Transport: **HTTP SSE** (Cloudflare Worker) + **client mock** fallback. Same event protocol. Optional **Workers AI** structuring (`mode=workers-ai`, prompt `workers-ai-struct-v3`) and hybrid `propose_patch_plan` -> diff `AI plan:`. Metrics show `promptVersion` / tokens; **costUsd stays null** when unmetered.

HITL: plan approve/reject, **tool args edit / continue** (client-mock + HTTP Worker `args_continue`/`args_edit` gate), soft-timeout → `tool.args_gate_released`, release gate.

## What hiring managers can verify

1. SSE streaming + cancel + mid-stream snapshot resume
2. Tool call timeline + fail/retry + `run_persisted` span
3. HITL: plan approve/reject, tool arg edit/continue, gate
4. Failure demos: schema invalid, citation block, duplicate (KV), XSS sandbox, step limit, reconnect, QA fail -> gate reject -> eval, 429 retry
5. Synthetic evals n=35 · native fixtures 26 · Workers AI spot (costUsd null)
6. Playwright · Vitest · axe · **eval gates** · live Workers AI structure/hybrid smoke

## Stack

Next.js (static export) · React · TypeScript · Zod · Playwright · Vitest · Cloudflare Workers · Workers AI · KV idempotency

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000/workbench/
pnpm test
pnpm test:e2e
pnpm bench
pnpm bench:gates
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