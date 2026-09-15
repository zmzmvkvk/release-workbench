import type { WorkbenchEvent } from "./protocol";
import type { FixtureId } from "./fixtures";

export type FixtureStep =
  | {
      kind: "event";
      delayMs: number;
      partial: {
        type: WorkbenchEvent["type"];
        payload: unknown;
      };
    }
  | { kind: "waitCancel"; delayMs: number }
  | { kind: "waitArgsEdit"; timeoutMs: number };

/** Happy-path execute phase after plan.approved (tools → diff → preview → qa → gate). */
export function buildExecuteSteps(scenarioId: string): FixtureStep[] {
  return [
    {
      kind: "event",
      delayMs: 150,
      partial: {
        type: "tool.started",
        payload: {
          callId: "t_patch",
          name: "apply_code_patch",
          args: { project: "cleanroom-react", scenarioId, allowedMime: ["*/*"] },
        },
      },
    },
    { kind: "waitArgsEdit", timeoutMs: 12_000 },
    {
      kind: "event",
      delayMs: 200,
      partial: {
        type: "tool.finished",
        payload: { callId: "t_patch", result: { filesChanged: 2 } },
      },
    },
    {
      kind: "event",
      delayMs: 200,
      partial: {
        type: "diff.updated",
        payload: {
          files: [
            {
              path: "src/components/CourseCardGrid.tsx",
              additions: 42,
              deletions: 3,
              patch: `@@ -1,5 +1,12 @@\n+export function CourseCardGrid({ items }: Props) {\n+  return (\n+    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">\n+      {items.map((item) => (\n+        <article key={item.id}>\n+          <h3>{item.title}</h3>\n+          <p>{item.price}</p>\n+          <button type="button">상세보기</button>\n+        </article>\n+      ))}\n+    </div>\n+  );\n+}`,
            },
            {
              path: "src/app/courses/page.tsx",
              additions: 8,
              deletions: 2,
              patch: `@@ -10,6 +10,8 @@\n-      <LegacyList />\n+      <CourseCardGrid items={courses} />\n`,
            },
          ],
        },
      },
    },
    {
      kind: "event",
      delayMs: 200,
      partial: {
        type: "preview.ready",
        payload: {
          desktopHtml:
            '<div style="font-family:system-ui;padding:16px"><h2>과정 목록</h2><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><article style="border:1px solid #333;padding:12px"><h3>React 입문</h3><p>₩49,000</p><button>상세보기</button></article><article style="border:1px solid #333;padding:12px"><h3>TypeScript</h3><p>₩59,000</p><button>상세보기</button></article><article style="border:1px solid #333;padding:12px"><h3>Next.js</h3><p>₩69,000</p><button>상세보기</button></article></div></div>',
          mobileHtml:
            '<div style="font-family:system-ui;padding:12px"><h2>과정 목록</h2><article style="border:1px solid #333;padding:12px;margin-bottom:8px"><h3>React 입문</h3><p>₩49,000</p><button>상세보기</button></article><article style="border:1px solid #333;padding:12px;margin-bottom:8px"><h3>TypeScript</h3><p>₩59,000</p><button>상세보기</button></article></div>',
        },
      },
    },
    {
      kind: "event",
      delayMs: 150,
      partial: {
        type: "qa.started",
        payload: { suites: ["playwright", "axe", "rules"] },
      },
    },
    {
      kind: "event",
      delayMs: 400,
      partial: {
        type: "tool.started",
        payload: { callId: "t_axe", name: "run_axe", args: { url: "preview" } },
      },
    },
    {
      kind: "event",
      delayMs: 250,
      partial: {
        type: "tool.finished",
        payload: { callId: "t_axe", result: { violations: 0 } },
      },
    },
    {
      kind: "event",
      delayMs: 200,
      partial: {
        type: "qa.finished",
        payload: {
          report: {
            passed: true,
            suites: [
              { name: "playwright", passed: true, detail: "CTA visible desktop+mobile" },
              { name: "axe", passed: true, detail: "0 violations" },
              { name: "rules", passed: true, detail: "no raw hex outside tokens" },
            ],
          },
        },
      },
    },
    {
      kind: "event",
      delayMs: 100,
      partial: {
        type: "trace.span",
        payload: {
          name: "execute",
          start: 0,
          end: 1800,
          attrs: { tools: 2, files: 2 },
        },
      },
    },
    {
      kind: "event",
      delayMs: 100,
      partial: {
        type: "metrics.sample",
        payload: { ttftMs: 180, tokens: 920, costUsd: 0 },
      },
    },
    {
      kind: "event",
      delayMs: 100,
      partial: { type: "gate.pending", payload: {} },
    },
  ];
}

export function shouldAutoExecute(fixture: FixtureId): boolean {
  // Fixtures that already include execute/reject in the structuring stream
  return [
    "tool_retry_once",
    "plan_reject_darkmode",
    "tool_args_edited",
    "preview_xss_sanitized",
    "step_limit_exceeded",
  ].includes(fixture);
}
