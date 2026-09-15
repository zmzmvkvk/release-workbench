import { describe, expect, it } from "vitest";
import { parseRetryAfterSec } from "./http-sse";

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
