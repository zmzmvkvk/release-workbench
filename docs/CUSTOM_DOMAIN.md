# Custom domain: roomy.page/workbench

## Status (2026-09-15 검증)

| URL | 결과 |
|-----|------|
| https://roomy.page/workbench | 200 — Release Workbench HTML |
| https://roomy.page/workbench/api/runs/stream | HTTP SSE mock (POST) |
| https://roomy-page-workbench.hommy.workers.dev/workbench | 200 (canonical workers.dev) |
| https://roomy.page/portfolio | 200 |

## Routing notes

- Workbench Worker: `roomy-page-workbench` (`workers_dev: true`).
- Direct `routes` on `roomy.page/workbench*` caused **522** when asset path mismatched; removed.
- Prefer serving via Worker's attached custom path **or** portfolio Worker 302 to workers.dev.
- Current verified: `https://roomy.page/workbench` returns live Workbench (title `Release Workbench`) and same-origin SSE.

## Operator checklist if 522 returns

1. Re-enable `workers_dev: true` on workbench wrangler.
2. Do **not** attach overlapping catch-all routes that break assets.
3. Portfolio `src/worker.js` fallback: 302 `/workbench` → `https://roomy-page-workbench.hommy.workers.dev/workbench…`.
4. Redeploy both: `portfolio/workbench` then `portfolio/web`.
