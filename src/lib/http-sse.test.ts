import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchRunSnapshot,
  parseRetryAfterSec,
  tryHttpStructuring,
  type RunSnapshot,
} from "./http-sse";

describe("parseRetryAfterSec", () => {
  it("reads Retry-After header", () => {
    const res = new Response(null, { headers: { "Retry-After": "5" } });
    expect(parseRetryAfterSec(res)).toBe(5);
  });

  it("clamps and defaults", () => {
    const res = new Response(null);
    expect(parseRetryAfterSec(res)).toBe(2);
    expect(parseRetryAfterSec(res, { retryAfter: 99 })).toBe(30);
  });
});

describe("fetchRunSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })),
    );
    expect(await fetchRunSnapshot("missing")).toBeNull();
  });

  it("returns snapshot body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              runId: "r1",
              eventCount: 3,
              eventTypes: ["run.started", "requirements.ready", "plan.proposed"],
              source: "memory",
            }),
            { status: 200 },
          ),
      ),
    );
    const snap = await fetchRunSnapshot("r1");
    expect(snap?.runId).toBe("r1");
    expect(snap?.eventCount).toBe(3);
    expect(snap?.source).toBe("memory");
  });
});

describe("tryHttpStructuring recover on SSE drop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns recovered when body errors and snapshot exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/runs/stream")) {
          const stream = new ReadableStream({
            start(controller) {
              controller.error(new TypeError("network drop"));
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Run-Id": "run_drop",
            },
          });
        }
        if (url.includes("/runs/run_drop")) {
          return new Response(
            JSON.stringify({
              runId: "run_drop",
              eventCount: 2,
              eventTypes: ["run.started", "stream.delta"],
              source: "kv",
            }),
            { status: 200 },
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const box: { snap: RunSnapshot | null } = { snap: null };
    const result = await tryHttpStructuring({
      scenarioId: "rw-004",
      fixture: "happy_card_grid",
      idempotencyKey: "k1",
      signal: new AbortController().signal,
      onEvent: () => {},
      onRunId: () => {},
      onStreamInterrupted: (snap) => {
        box.snap = snap;
      },
    });
    expect(result.kind).toBe("recovered");
    if (result.kind === "recovered") {
      expect(result.runId).toBe("run_drop");
      expect(result.eventCount).toBe(2);
    }
    expect(box.snap?.eventCount).toBe(2);
  });
});
