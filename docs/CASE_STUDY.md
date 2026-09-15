# Case study — Release Workbench

Public hiring evidence for internal-ops AX frontend.

## Links

- Live: https://roomy.page/workbench/
- Evals: https://roomy.page/workbench/evals
- Demo (90s): https://roomy.page/workbench/demo/release-workbench-90s.webm
- QA fail deep link: https://roomy.page/workbench/?mock=1&scenario=rw-027&filter=failure&autorun=1
- Failure matrix: https://roomy.page/workbench/evals#failures
- GitHub: https://github.com/zmzmvkvk/release-workbench
- CI: https://github.com/zmzmvkvk/release-workbench/actions

## Problem

Operating FE experience alone was weak AX hiring evidence. Internal AI automation could not be verified externally. Openings (JYP AI, Wrtn AX FE, etc.) look for streaming, tools, approval, failure recovery, and evals — not portfolio copy polish.

## Approach

Ship a **public work system**: request → structure with citations → HITL approve/edit/reject → tools/diff/preview/QA → gate. Same event protocol for client mock, Worker SSE mock, and Workers AI. Live HTTP execute pauses on first `tool.started` until `args_continue`/`args_edit` (KV across isolates). Preview uses DOMPurify + sandboxed iframe. Gate reject writes `eval.case_recorded` into the public failure→eval loop.

## Evidence (verified)

| Item | Status |
| --- | --- |
| Live app + HTTP SSE | yes (`roomy.page` same-origin) |
| HTTP HITL args gate | yes (KV resume + `waitUntil` persist) |
| 32 synthetic scenarios | yes |
| Failure demos (10+) + E2E | yes (incl. QA fail → gate reject → eval) |
| Playwright / Vitest / axe CI | yes (public Actions) |
| Mock bench n=32 + Workers AI spot | yes (extraction/toolSelection/conflict = 1) |
| Architecture / protocol / security / failures | yes (`docs/`) |
| 60–90s demo | yes (includes QA fail + eval record) |

## Numbers (honest)

- Mock TTFT ≈ fixture delay (~200ms) — not a real LLM.
- Workers AI spot (prompt `workers-ai-struct-v3`, n=5): TTFT p50≈473ms, tokens p50≈236, source-bound citations; **costUsd null** (provider 미제공, 추정 안 함).
- No company productivity percentages.

## Internal automation (second case)

Design principles only. No internal screens or metrics. This clean-room demo is the public difference.
