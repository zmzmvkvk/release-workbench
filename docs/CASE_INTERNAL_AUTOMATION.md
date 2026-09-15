# Second case — Internal automation (principles only)

This is **not** a public product demo. No company screens, logs, or productivity percentages.

## What existed (narrative, not metrics)

At MegaStudy-style content ops, requests arrived through scattered channels. The working pattern was:

1. Structure messy asks into checkable requirements  
2. Implement with human review gates (not blind AI paste)  
3. Verify with repeatable checks (Playwright / axe-style)  
4. Only then release  

Claude/Codex helped drafting; humans owned accept/reject.

## Why it is not the flagship evidence

External reviewers cannot open the internal tool. Numbers like lead-time % were not kept as auditable public claims.

## How Release Workbench differs (public)

| Internal | Public Release Workbench |
| --- | --- |
| Closed UI | https://roomy.page/workbench |
| Company data | Synthetic scenarios only |
| Hard to cite in hiring | Live SSE, CI, evals, failure demos |

## Design principles carried over

- Do not trust model output without citations / review  
- Prefer protocol + state machine over chat transcript  
- Failures (cancel, schema, duplicate, XSS) must be demonstrable  
- Measure with disclosed sample size, model, prompt version  

See also: `docs/CASE_STUDY.md`, `docs/SECURITY.md`.
