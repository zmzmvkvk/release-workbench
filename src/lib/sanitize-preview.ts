import DOMPurify from "dompurify";

function detectStripped(html: string): string[] {
  const stripped: string[] = [];
  if (/<script[\s>]/i.test(html)) stripped.push("script");
  if (/\son\w+\s*=/i.test(html)) stripped.push("event-handlers");
  if (/javascript:/i.test(html)) stripped.push("javascript-url");
  if (/<(iframe|object|embed)\b/i.test(html)) stripped.push("embedded-frame");
  return [...new Set(stripped)];
}

/** Always-on strip for Node/SSR; browser also runs DOMPurify after. */
function stripDangerousFallback(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?(iframe|object|embed|link)\b[^>]*>/gi, "");
}

/** Preview sanitization before sandboxed iframe srcDoc. */
export function sanitizePreviewHtml(html: string): {
  html: string;
  stripped: string[];
} {
  const stripped = detectStripped(html);
  let clean = stripDangerousFallback(html);
  if (typeof window !== "undefined") {
    try {
      clean = DOMPurify.sanitize(clean, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "iframe", "object", "embed", "link"],
        FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus"],
      });
    } catch {
      /* keep regex fallback */
    }
  }
  return { html: clean, stripped };
}
