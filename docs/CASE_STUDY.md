# Case study — Release Workbench

Public hiring evidence for internal-ops AX frontend.

## Links

- Live: https://roomy.page/workbench
- Evals: https://roomy.page/workbench/evals
- Demo (90s): https://roomy.page/workbench/demo/release-workbench-90s.webm
- GitHub: https://github.com/zmzmvkvk/release-workbench
- CI: https://github.com/zmzmvkvk/release-workbench/actions

## Problem

Operating FE experience alone was weak AX hiring evidence. Internal AI automation could not be verified externally. Openings (JYP AI, Wrtn AX FE, etc.) look for streaming, tools, approval, failure recovery, and evals — not portfolio copy polish.

## Approach

Ship a **public work system**: request → structure with citations → HITL approve/edit/reject → tools/diff/preview/QA → gate. Same event protocol for client mock, Worker SSE mock, and Workers AI.

## Evidence (verified)

| Item | Status |
| --- | --- |
| Live app + HTTP SSE | yes |
| 32 synthetic scenarios | yes |
| Failure demos (10) + E2E | yes |
| Playwright / Vitest / axe CI | yes (public Actions) |
| Mock bench n=32 + Workers AI spot | yes (separate tables) |
| Architecture / protocol / security / failures | yes (`docs/`) |
| 60–90s demo | yes |

## Numbers (honest)

- Mock TTFT ≈ fixture delay (~200ms) — not a real LLM.
- Workers AI spot (prompt `workers-ai-struct-v3`, n=5): TTFT p50≈929ms, source-bound citations; cost/tokens not reported by provider → null.
- No company productivity percentages.

## Internal automation (second case)

Design principles only. No internal screens or metrics. This clean-room demo is the public difference.
