# Security & disclosure scope

Public demo scope. No company secrets, internal screens, or real user data.

## Allowed to publish

- Synthetic scenario text (education / retail **fictional** ops)
- Mock SSE events, state machine, eval labels
- Clean-room React diff / sandboxed preview HTML
- Synthetic benchmark numbers (with sample size, model, prompt version)

## Not published

- MegaStudy / Lotte **internal screens, logs, metrics**
- Real API keys, customer PII
- Private URLs of internal automation tools

Internal automation is a **second portfolio case** only: design principles + how this public demo differs.

## Demo controls

| Risk | Control |
| --- | --- |
| Model / source HTML XSS | **DOMPurify** (`sanitizePreviewHtml`) + `iframe sandbox=""` + `preview.sanitized` |
| Arbitrary code execution | Mock path shows patch strings only; live execute stays in Worker fixtures |
| Duplicate side effects | `idempotencyKey` → `run.duplicate_blocked` (KV) |
| Stream overload | per-isolate `maxActiveStreams: 8` → HTTP 429 + `Retry-After` + client one retry |
| Ungrounded generation | Missing citations disable plan approve |
| Excessive changes | `run.step_limit` |
| Stream abort | cancel → `AbortSignal` |
| Mid-stream drop | `GET /api/runs/:id` (KV-first) → client `stream.reconnect` / `recovered` |
| Stale cross-isolate view | execute SSE ends with `trace.span` `run_persisted` (`toolNames`) |
| Args gate hang | soft-timeout (~12s) → `tool.args_gate_released` (`reason=soft_timeout`); UI banner ~9s; deep link `?holdArgs=1` |

## URL note (roomy.page)

Custom domain: path **without** trailing slash + query (`/workbench?mock=1`) can 522.
Always use trailing slash: `/workbench/?mock=1&scenario=rw-027`.

## Auth (later / FDE track)

- Demo: no auth (public mock)
- Product-shaped: session user · run ownership · audit log (`gate.*`, `plan.*`)

## License

- Next.js / React — MIT
- Scenarios / docs — follow repository license
