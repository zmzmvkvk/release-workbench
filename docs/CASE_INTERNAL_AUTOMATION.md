# Second case — Internal automation (principles only)

This is **not** a public product demo. No company screens, logs, GUIDE pages, or productivity percentages.

## What existed (narrative, not metrics)

At MegaStudy-style content ops, requests arrived through scattered channels. Internal teams often keep a **data GUIDE** (where sources live, who updates what). The portable pattern — not the internal UI — is:

1. Structure messy asks into checkable requirements with provenance  
2. Implement with human review gates (not blind AI paste)  
3. Verify with repeatable checks (Playwright / axe-style)  
4. Failures feed back into the evaluation set  
5. Only then release  

Claude/Codex helped drafting; humans owned accept/reject.

## Why it is not the flagship evidence

External reviewers cannot open the internal GUIDE/tool. Screenshots and company metrics are out of scope (`docs/SECURITY.md`).

## How Release Workbench differs (public)

| Internal (closed) | Public Release Workbench |
| --- | --- |
| GUIDE / ops data hub | Synthetic scenarios + citations only |
| Closed UI | https://roomy.page/workbench |
| Hard to cite in hiring | Live SSE, CI, evals, failure demos, soft-timeout |

## Design principles carried over

- Do not trust model output without citations / review  
- Prefer protocol + state machine over chat transcript  
- Record **who changed what when** (plan / args / gate → audit events)  
- Failures (cancel, schema, duplicate, XSS, soft-timeout) must be demonstrable  
- Measure with disclosed sample size, model, prompt version  

## Next public artifact (publisher-shaped)

**Run Data Inspector** (shipped): https://roomy.page/workbench/#data-inspector — one run view: source → requirements+citations → HITL → tools → QA → gate → eval.  

**Dataset Studio** (shipped, read-only catalog): https://roomy.page/workbench/evals#dataset-studio — provenance: synthetic_authored / failure_demo / gate_reject_loop / workers_ai_spot.

**Next:** Dataset Studio write path (add case API) — not required for hiring browse evidence.

See also: `docs/CASE_STUDY.md`, `docs/SECURITY.md`, `docs/HIRING_BRIEF.md`.
