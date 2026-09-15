import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchRunSnapshot, parseRetryAfterSec } from "./http-sse";

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
