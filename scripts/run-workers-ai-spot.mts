/**
 * Refresh Workers AI spot metrics (honest; no invented cost).
 * Usage: pnpm exec tsx scripts/run-workers-ai-spot.mts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT =
  process.env.WORKBENCH_SSE_URL ??
  "https://roomy-page-workbench.hommy.workers.dev/workbench/api/runs/stream";

const CASES = [
  { scenarioId: "rw-001", sourceText: "수강신청 배너 30% 할인 문구와 상세 20%가 충돌" },
  { scenarioId: "rw-004", sourceText: "desktop 3 columns mobile 1 column CTA detail" },
  { scenarioId: "rw-007", sourceText: "invalid json stress: priority must be enum" },
  { scenarioId: "rw-012", sourceText: "접근성 라벨을 추가하되 근거 원문은 비워둔 요청" },
  { scenarioId: "rw-002", sourceText: "강의 상세 이미지에 alt 텍스트가 없다" },
];

type SpotCase = {
  scenarioId: string;
  requirementsReady: boolean;
  ttftMs: number | null;
  tokens: number | null;
  sourceQuote: boolean;
};

async function runOne(c: (typeof CASES)[number]): Promise<SpotCase> {
  const key = `spot-${c.scenarioId}-${Date.now()}`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId: c.scenarioId,
      fixture: "happy_card_grid",
      idempotencyKey: key,
      mode: "workers-ai",
      sourceText: c.sourceText,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let requirementsReady = false;
  let ttftMs: number | null = null;
  let tokens: number | null = null;
  let sourceQuote = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const ev = JSON.parse(line.slice(6)) as {
        type: string;
        payload?: Record<string, unknown>;
      };
      if (ev.type === "requirements.ready") {
        requirementsReady = true;
        const reqs = (ev.payload?.requirements as { citations?: { quote?: string }[] }[]) ?? [];
        sourceQuote = reqs.every(
          (r) =>
            Array.isArray(r.citations) &&
            r.citations.some((x) =>
              typeof x.quote === "string" && c.sourceText.includes(x.quote),
            ),
        );
      }
      if (ev.type === "metrics.sample") {
        if (typeof ev.payload?.ttftMs === "number") ttftMs = ev.payload.ttftMs;
        if (typeof ev.payload?.tokens === "number") tokens = ev.payload.tokens;
      }
      if (ev.type === "requirements.invalid") {
        requirementsReady = false;
      }
    }
  }
  return { scenarioId: c.scenarioId, requirementsReady, ttftMs, tokens, sourceQuote };
}

function pct(n: number, d: number) {
  return d === 0 ? 0 : n / d;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

const cases: SpotCase[] = [];
for (const c of CASES) {
  process.stderr.write(`run ${c.scenarioId}…\n`);
  cases.push(await runOne(c));
}

const ttfts = cases.map((c) => c.ttftMs).filter((n): n is number => n != null).sort((a, b) => a - b);
const tokens = cases.map((c) => c.tokens).filter((n): n is number => n != null);
const ready = cases.filter((c) => c.requirementsReady).length;
const quotes = cases.filter((c) => c.sourceQuote).length;

const out = {
  meta: {
    title: "Workers AI spot check",
    updated: new Date().toISOString(),
    model: "@cf/meta/llama-3.2-3b-instruct",
    promptVersion: "workers-ai-struct-v3",
    runsPerCase: 1,
    sampleSize: cases.length,
    endpoint: ENDPOINT,
    notes: [
      "소량 스팟. mock 벤치 n=32와 합산하지 않음.",
      "v3: citations must be SOURCE substrings; sanitizeRequirement repairs invented quotes.",
      "ttftMs = AI.run wall time (non-stream).",
      tokens.length
        ? `tokens: usage.total_tokens 파싱 (${tokens.length}/${cases.length}건). costUsd는 provider 미제공 → null.`
        : "tokens·costUsd null (이번 표본에서 usage 없음).",
      `이번 표본: ready ${ready}/${cases.length}, sourceQuote ${quotes}/${cases.length}.`,
    ],
  },
  aggregate: {
    sampleSize: cases.length,
    requirementsReadyRate: pct(ready, cases.length),
    schemaInvalidObserved: cases.length - ready,
    fallbackRate: 0,
    sourceQuoteRate: pct(quotes, cases.length),
    ttftP50Ms: percentile(ttfts, 50),
    ttftP95Ms: percentile(ttfts, 95),
    totalP50Ms: percentile(ttfts, 50),
    totalP95Ms: percentile(ttfts, 95),
    tokensP50: tokens.length
      ? percentile([...tokens].sort((a, b) => a - b), 50)
      : null,
    costUsdPerRequest: null as null,
  },
  cases,
};

const path = resolve("src/data/eval-workers-ai-spot.json");
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log("wrote", path);
console.log(JSON.stringify(out.aggregate, null, 2));
