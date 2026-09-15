import type { WorkbenchEvent } from "./protocol";

export type FixtureId =
  | "happy_card_grid"
  | "happy_empty_state"
  | "cancel_during_structuring"
  | "conflict_discount_copy"
  | "invalid_requirements_json"
  | "duplicate_blocked"
  | "stream_reconnect"
  | "tool_retry_once"
  | "plan_reject_darkmode"
  | "tool_args_edited"
  | "citation_missing_block"
  | "preview_xss_sanitized"
  | "step_limit_exceeded"
  | "qa_playwright_mismatch";

type Step =
  | { kind: "event"; delayMs: number; partial: Omit<WorkbenchEvent, "id" | "runId" | "seq" | "ts"> & { type: WorkbenchEvent["type"]; payload: unknown } }
  | { kind: "waitCancel"; delayMs: number };

function baseSteps(scenarioId: string): Step[] {
  return [
    {
      kind: "event",
      delayMs: 0,
      partial: {
        type: "run.started",
        payload: { scenarioId, mode: "mock", idempotencyKey: `${scenarioId}-key` },
      },
    },
    {
      kind: "event",
      delayMs: 200,
      partial: {
        type: "stream.delta",
        payload: { channel: "structuring", text: "원문에서 요구사항을 추출하는 중…" },
      },
    },
  ];
}

export function buildFixtureSteps(fixture: FixtureId, scenarioId: string): Step[] {
  switch (fixture) {
    case "cancel_during_structuring":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "stream.delta",
            payload: { channel: "structuring", text: "필터·기간·키워드 필드를 구조화…" },
          },
        },
        { kind: "waitCancel", delayMs: 2_000 },
        {
          kind: "event",
          delayMs: 400,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                { id: "r1", text: "카테고리 필터", priority: "must", citations: [] },
              ],
              conflicts: [],
            },
          },
        },
      ];
    case "invalid_requirements_json":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 400,
          partial: {
            type: "requirements.invalid",
            payload: { issues: [{ path: "requirements[0].priority", message: "expected enum" }] },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: {
            type: "run.failed",
            payload: { code: "SCHEMA", message: "structured output failed validation" },
          },
        },
      ];
    case "conflict_discount_copy":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 350,
          partial: {
            type: "citation.attached",
            payload: {
              reqId: "r1",
              quote: "지금 신청하면 10% 할인",
              sourceSpan: { sourceIndex: 0, start: 12, end: 26 },
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "conflict.detected",
            payload: {
              a: "r1",
              b: "r2",
              kind: "contradiction",
              note: "할인율 표기 vs 법무 금지",
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "배너 문구를 할인 표기로 변경",
                  priority: "must",
                  citations: [{ quote: "10% 할인", sourceIndex: 0, start: 12, end: 26 }],
                },
                {
                  id: "r2",
                  text: "할인율 표기 금지, 얼리버드 혜택만",
                  priority: "must",
                  citations: [{ quote: "할인율 표기는 이번 시즌에 금지", sourceIndex: 1, start: 0, end: 20 }],
                },
              ],
              conflicts: [
                {
                  id: "c1",
                  kind: "contradiction",
                  requirementIds: ["r1", "r2"],
                  note: "할인 표기 충돌",
                },
              ],
            },
          },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: {
            type: "plan.proposed",
            payload: {
              steps: ["충돌 해소 대기", "배너 카피 패치", "모바일 두 줄 검증"],
            },
          },
        },
      ];
    case "stream_reconnect":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "stream.delta",
            payload: { channel: "structuring", text: "진행률 바 요구 추출…" },
          },
        },
        {
          kind: "event",
          delayMs: 400,
          partial: {
            type: "stream.reconnect",
            payload: { lastSeq: 2 },
          },
        },
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "수강중 강의 진행률 바",
                  priority: "must",
                  citations: [{ quote: "진행률 바", sourceIndex: 0, start: 10, end: 15 }],
                },
                {
                  id: "r2",
                  text: "완료 숫자 표시",
                  priority: "should",
                  citations: [{ quote: "숫자로 표시", sourceIndex: 0, start: 16, end: 22 }],
                },
              ],
              conflicts: [],
            },
          },
        },
      ];
    case "duplicate_blocked":
      return [
        {
          kind: "event",
          delayMs: 0,
          partial: {
            type: "run.duplicate_blocked",
            payload: { existingRunId: "run_existing_demo" },
          },
        },
      ];
    case "happy_empty_state":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "stream.delta",
            payload: {
              channel: "structuring",
              text: "빈 상태 일러스트·CTA 구조화…",
            },
          },
        },
        {
          kind: "event",
          delayMs: 400,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "위시리스트 빈 상태 Empty view",
                  priority: "must",
                  citations: [
                    {
                      quote: "위시리스트 비었을 때",
                      sourceIndex: 0,
                      start: 0,
                      end: 10,
                    },
                  ],
                },
                {
                  id: "r2",
                  text: "일러스트 assets/empty-wish.svg",
                  priority: "must",
                  citations: [
                    {
                      quote: "assets/empty-wish.svg",
                      sourceIndex: 0,
                      start: 28,
                      end: 49,
                    },
                  ],
                },
                {
                  id: "r3",
                  text: "CTA 문구 '강의 둘러보기'",
                  priority: "must",
                  citations: [
                    {
                      quote: "강의 둘러보기",
                      sourceIndex: 0,
                      start: 15,
                      end: 22,
                    },
                  ],
                },
                {
                  id: "r4",
                  text: "빈 목록에서만 Empty view 표시",
                  priority: "should",
                  citations: [
                    {
                      quote: "위시리스트 비었을 때",
                      sourceIndex: 0,
                      start: 0,
                      end: 10,
                    },
                  ],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "plan.proposed",
            payload: { steps: ["Empty view 패치", "미리보기", "axe 검사"] },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: {
            type: "metrics.sample",
            payload: {
              ttftMs: 175,
              tokens: 390,
              costUsd: null,
              provider: "mock",
              model: "deterministic",
              promptVersion: "none-mock",
            },
          },
        },
      ];
    case "happy_card_grid":
    default:
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "stream.delta",
            payload: { channel: "structuring", text: "카드 그리드·CTA 구조화…" },
          },
        },
        {
          kind: "event",
          delayMs: 400,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "데스크톱 3열 / 모바일 1열 카드 그리드",
                  priority: "must",
                  citations: [{ quote: "3열(데스크톱) / 1열(모바일)", sourceIndex: 0, start: 10, end: 30 }],
                },
                {
                  id: "r2",
                  text: "카드에 제목·가격·CTA",
                  priority: "must",
                  citations: [{ quote: "제목, 가격, CTA", sourceIndex: 0, start: 32, end: 45 }],
                },
                {
                  id: "r3",
                  text: "CTA 문구는 상세보기",
                  priority: "must",
                  citations: [{ quote: "상세보기", sourceIndex: 0, start: 46, end: 50 }],
                },
                {
                  id: "r4",
                  text: "반응형 레이아웃 유지",
                  priority: "should",
                  citations: [{ quote: "3열(데스크톱) / 1열(모바일)", sourceIndex: 0, start: 10, end: 30 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "plan.proposed",
            payload: { steps: ["레이아웃 패치", "미리보기", "axe 검사"] },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: {
            type: "metrics.sample",
            payload: {
              ttftMs: 180,
              tokens: 420,
              costUsd: null,
              provider: "mock",
              model: "deterministic",
              promptVersion: "none-mock",
            },
          },
        },
      ];
    case "tool_retry_once":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "검색 자동완성 키보드 지원",
                  priority: "must",
                  citations: [{ quote: "키보드 위아래·Enter", sourceIndex: 0, start: 0, end: 12 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: { type: "plan.approved", payload: { by: "mock" } },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "tool.started",
            payload: { callId: "t1", name: "apply_code_patch", args: { file: "Search.tsx" } },
          },
        },
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "tool.failed",
            payload: { callId: "t1", error: "sandbox timeout", retryable: true },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: { type: "tool.retried", payload: { callId: "t1", attempt: 2 } },
        },
        {
          kind: "event",
          delayMs: 250,
          partial: {
            type: "tool.finished",
            payload: { callId: "t1", result: { ok: true } },
          },
        },
      ];
    case "plan_reject_darkmode":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "전체 다크모드 전환 및 기존 토큰 삭제",
                  priority: "must",
                  citations: [{ quote: "다크모드로 전환", sourceIndex: 0, start: 0, end: 10 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "plan.proposed",
            payload: { steps: ["테마 토큰 삭제", "전역 다크 강제"] },
          },
        },
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "plan.rejected",
            payload: { reason: "scope too large / destructive" },
          },
        },
      ];
    case "citation_missing_block":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 300,
          partial: {
            type: "citation.missing",
            payload: { reqId: "r1" },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                { id: "r1", text: "요즘 느낌으로 예쁘게", priority: "must", citations: [] },
              ],
              conflicts: [],
            },
          },
        },
      ];
    case "preview_xss_sanitized":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 250,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "공지 HTML 렌더",
                  priority: "must",
                  citations: [{ quote: "HTML을 그대로 렌더", sourceIndex: 0, start: 0, end: 12 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: { type: "plan.approved", payload: { by: "mock" } },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "preview.sanitized",
            payload: { stripped: ["onerror", "script"] },
          },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: {
            type: "preview.ready",
            payload: {
              desktopHtml:
                '<div style="padding:12px;font-family:system-ui"><p>안전한 공지 본문</p><img alt="banner" src="about:blank"/></div>',
              mobileHtml:
                '<div style="padding:12px;font-family:system-ui"><p>안전한 공지 본문</p></div>',
            },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: {
            type: "qa.finished",
            payload: {
              report: {
                passed: true,
                suites: [{ name: "sanitize", passed: true, detail: "dangerous attrs stripped" }],
              },
            },
          },
        },
      ];
    case "step_limit_exceeded":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [{ id: "r1", text: "10개 화면 일괄 수정", priority: "must", citations: [] }],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: { type: "plan.approved", payload: { by: "mock" } },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "run.step_limit",
            payload: { maxSteps: 8, step: 9 },
          },
        },
      ];
    case "tool_args_edited":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 250,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "첨부파일 PDF만",
                  priority: "must",
                  citations: [{ quote: "PDF만 허용", sourceIndex: 0, start: 0, end: 8 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 100,
          partial: { type: "plan.approved", payload: { by: "mock" } },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: {
            type: "tool.started",
            payload: {
              callId: "t1",
              name: "apply_code_patch",
              args: { allowedMime: ["*/*"] },
            },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "tool.args_edited",
            payload: { callId: "t1", args: { allowedMime: ["application/pdf"] } },
          },
        },
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "tool.finished",
            payload: { callId: "t1", result: { ok: true } },
          },
        },
      ];
    case "qa_playwright_mismatch":
      return [
        ...baseSteps(scenarioId),
        {
          kind: "event",
          delayMs: 200,
          partial: {
            type: "requirements.ready",
            payload: {
              requirements: [
                {
                  id: "r1",
                  text: "CTA 문구 수강신청",
                  priority: "must",
                  citations: [{ quote: "수강신청", sourceIndex: 0, start: 0, end: 4 }],
                },
              ],
              conflicts: [],
            },
          },
        },
        {
          kind: "event",
          delayMs: 150,
          partial: {
            type: "plan.proposed",
            payload: { steps: ["CTA 패치", "Playwright 검수"] },
          },
        },
      ];
  }
}

export function scenarioDefaultFixture(scenarioId: string): FixtureId {
  const map: Record<string, FixtureId> = {
    "rw-001": "conflict_discount_copy",
    "rw-004": "happy_card_grid",
    "rw-005": "cancel_during_structuring",
    "rw-006": "stream_reconnect",
    "rw-007": "invalid_requirements_json",
    "rw-008": "tool_retry_once",
    "rw-009": "plan_reject_darkmode",
    "rw-010": "tool_args_edited",
    "rw-011": "duplicate_blocked",
    "rw-012": "citation_missing_block",
    "rw-013": "preview_xss_sanitized",
    "rw-014": "step_limit_exceeded",
    "rw-027": "qa_playwright_mismatch",
    "rw-024": "happy_empty_state",
    "rw-030": "happy_card_grid",
    "rw-033": "conflict_discount_copy",
    "rw-034": "tool_args_edited",
    "rw-035": "duplicate_blocked",
  };
  return map[scenarioId] ?? "happy_card_grid";
}
