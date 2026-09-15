import { describe, expect, it } from "vitest";
import { sanitizePreviewHtml } from "./sanitize-preview";

describe("sanitizePreviewHtml", () => {
  it("strips script and event handlers", () => {
    const dirty =
      '<img src=x onerror="alert(1)"/><script>evil()</script><p>ok</p>';
    const { html, stripped } = sanitizePreviewHtml(dirty);
    expect(html).not.toMatch(/script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).toContain("ok");
    expect(stripped).toEqual(
      expect.arrayContaining(["script", "event-handlers"]),
    );
  });
});
