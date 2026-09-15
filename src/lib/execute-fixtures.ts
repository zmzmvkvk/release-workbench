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
  const qaFailed = scenarioId === "rw-027";
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
              patch: `@@ -1,5 +1,12 @@\n+export function CourseCardGrid({ items }: Props) {\n+  return (\n+    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">\n+      {items.map((item) => (\n+        <article key={item.id}>\n+          <h3>{item.title}</h3>\n+          <p>{item.price}</p>\n+          <button type="button">${qaFailed ? "수강신청" : "상세보기"}</button>\n+        </article>\n+      ))}\n+    </div>\n+  );\n+}`,
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
          desktopHtml: qaFailed
            ? '<div><button>수강신청</button></div>'
            : '<div style="font-family:system-ui;padding:16px"><h2>과정 목록</h2><button>상세보기</button></div>',
          mobileHtml: qaFailed
            ? '<div><button>수강신청</button></div>'
            : '<div style="padding:12px"><button>상세보기</button></div>',
        },
      },
    },
    {
      kind: "event",
      delayMs: 150,
      partial: {
        type: "qa.started",
        payload: { suites: ["playwright", "axe"] },
      },
    },
    {
      kind: "event",
      delayMs: 300,
      partial: {
        type: "qa.finished",
        payload: {
          report: qaFailed
            ? {
                passed: false,
                suites: [
                  {
                    name: "playwright",
                    passed: false,
                    detail: "getByRole('button',{name:'신청하기'}) not found — suggest rename CTA or fix test",
                  },
                  { name: "axe", passed: true, detail: "0 violations" },
                ],
              }
            : {
                passed: true,
                suites: [
                  { name: "playwright", passed: true, detail: "CTA visible desktop+mobile" },
                  { name: "axe", passed: true, detail: "0 violations" },
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
        payload: { name: "execute", start: 0, end: 1800, attrs: { tools: 1 } },
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
