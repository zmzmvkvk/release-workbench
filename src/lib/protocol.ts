import { z } from "zod";

export const RunStatusSchema = z.enum([
  "idle",
  "structuring",
  "awaiting_plan_review",
  "rejected_at_plan",
  "executing",
  "awaiting_gate",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const EventTypeSchema = z.enum([
  "run.started",
  "run.cancelled",
  "run.duplicate_blocked",
  "run.step_limit",
  "run.failed",
  "run.completed",
  "stream.delta",
  "stream.reconnect",
  "requirements.delta",
  "requirements.ready",
  "requirements.invalid",
  "citation.attached",
  "citation.missing",
  "conflict.detected",
  "plan.proposed",
  "plan.edited",
  "plan.approved",
  "plan.rejected",
  "tool.started",
  "tool.args_edited",
  "tool.finished",
  "tool.failed",
  "tool.retried",
  "diff.updated",
  "preview.ready",
  "preview.sanitized",
  "qa.started",
  "qa.finished",
  "gate.pending",
  "gate.approved",
  "gate.edit_requested",
  "gate.rejected",
  "trace.span",
  "metrics.sample",
  "eval.case_recorded",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const WorkbenchEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  type: EventTypeSchema,
  payload: z.unknown(),
});
export type WorkbenchEvent = z.infer<typeof WorkbenchEventSchema>;

export type TimelineItem = {
  seq: number;
  type: EventType;
  ts: string;
  summary: string;
  level: "info" | "warn" | "error" | "success";
};

export type FileDiff = {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
};

export type ToolCallView = {
  callId: string;
  name: string;
  args: unknown;
  status: "running" | "succeeded" | "failed" | "aborted";
  error?: string;
  result?: unknown;
};

export type QaReport = {
  passed: boolean;
  suites: { name: string; passed: boolean; detail: string }[];
};

export type RunState = {
  status: RunStatus;
  runId: string | null;
  idempotencyKey: string | null;
  mode: "mock" | "live" | null;
  scenarioId: string | null;
  events: WorkbenchEvent[];
  timeline: TimelineItem[];
  lastSeq: number;
  error: string | null;
  requirements: unknown[];
  conflicts: unknown[];
  planSteps: string[];
  tools: ToolCallView[];
  diffs: FileDiff[];
  preview: { desktopHtml: string | null; mobileHtml: string | null; sanitized: string[] };
  qa: QaReport | null;
  metrics: { ttftMs?: number; tokens?: number; costUsd?: number } | null;
  traces: { name: string; start: number; end: number; attrs?: unknown }[];
  duplicateBlocked: boolean;
  citationMissing: boolean;
  approveBlockedReason: string | null;
  gatePending: boolean;
};

export const initialRunState = (): RunState => ({
  status: "idle",
  runId: null,
  idempotencyKey: null,
  mode: null,
  scenarioId: null,
  events: [],
  timeline: [],
  lastSeq: -1,
  error: null,
  requirements: [],
  conflicts: [],
  planSteps: [],
  tools: [],
  diffs: [],
  preview: { desktopHtml: null, mobileHtml: null, sanitized: [] },
  qa: null,
  metrics: null,
  traces: [],
  duplicateBlocked: false,
  citationMissing: false,
  approveBlockedReason: null,
  gatePending: false,
});

function summarize(event: WorkbenchEvent): TimelineItem {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const level =
    event.type.includes("failed") ||
    event.type.includes("invalid") ||
    event.type.includes("rejected") ||
    event.type === "run.step_limit" ||
    event.type === "citation.missing"
      ? "error"
      : event.type.includes("cancelled") ||
          event.type.includes("duplicate") ||
          event.type.includes("reconnect")
        ? "warn"
        : event.type.includes("approved") ||
            event.type.includes("completed") ||
            event.type.includes("finished") ||
            event.type.includes("ready")
          ? "success"
          : "info";

  let summary: string = event.type;
  if (event.type === "stream.delta" && typeof payload.text === "string") {
    summary = `stream: ${String(payload.text).slice(0, 80)}`;
  } else if (event.type === "run.started") {
    summary = `run started (${String(payload.mode ?? "?")})`;
  } else if (event.type === "run.cancelled") {
    summary = `cancelled: ${String(payload.reason ?? "")}`;
  } else if (event.type === "tool.started") {
    summary = `tool ${String(payload.name)} started`;
  } else if (event.type === "tool.failed") {
    summary = `tool failed: ${String(payload.error ?? "")}`;
  } else if (event.type === "tool.retried") {
    summary = `tool retried (attempt ${String(payload.attempt ?? "?")})`;
  } else if (event.type === "requirements.ready") {
    summary = "requirements ready for review";
  } else if (event.type === "run.duplicate_blocked") {
    summary = `duplicate blocked → ${String(payload.existingRunId ?? "")}`;
  }

  return {
    seq: event.seq,
    type: event.type,
    ts: event.ts,
    summary,
    level,
  };
}

/** Apply one validated event. Ignores seq <= lastSeq (reconnect idempotency). */
export function applyEvent(state: RunState, raw: unknown): RunState {
  const parsed = WorkbenchEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ...state,
      error: `invalid event: ${parsed.error.message}`,
    };
  }
  const event = parsed.data;
  if (event.seq <= state.lastSeq) {
    return state;
  }

  const next: RunState = {
    ...state,
    events: [...state.events, event],
    timeline: [...state.timeline, summarize(event)],
    lastSeq: event.seq,
    duplicateBlocked: false,
    error: null,
  };

  const payload = (event.payload ?? {}) as Record<string, unknown>;

  switch (event.type) {
    case "run.started":
      return {
        ...next,
        status: "structuring",
        runId: event.runId,
        mode: payload.mode === "live" ? "live" : "mock",
        scenarioId: typeof payload.scenarioId === "string" ? payload.scenarioId : null,
        idempotencyKey:
          typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : null,
      };
    case "requirements.ready": {
      const requirements = Array.isArray(payload.requirements) ? payload.requirements : [];
      const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
      const missingCitation = requirements.some((r) => {
        const req = r as { citations?: unknown[] };
        return !Array.isArray(req.citations) || req.citations.length === 0;
      });
      const blockReason =
        conflicts.length > 0
          ? "충돌 해소 전 승인 불가"
          : missingCitation || next.citationMissing
            ? "근거(citation) 없는 요구 — 승인 불가"
            : null;
      return {
        ...next,
        status: "awaiting_plan_review",
        requirements,
        conflicts,
        citationMissing: missingCitation || next.citationMissing,
        approveBlockedReason: blockReason,
      };
    }
    case "citation.missing":
      return {
        ...next,
        citationMissing: true,
        approveBlockedReason: "근거(citation) 없는 요구 — 승인 불가",
      };
    case "requirements.invalid":
      return {
        ...next,
        status: "failed",
        error: "requirements schema invalid",
      };
    case "plan.approved":
      return { ...next, status: "executing", approveBlockedReason: null };
    case "plan.proposed":
      return {
        ...next,
        planSteps: Array.isArray(payload.steps)
          ? payload.steps.map(String)
          : next.planSteps,
      };
    case "plan.rejected":
      return { ...next, status: "rejected_at_plan" };
    case "tool.started": {
      const callId = String(payload.callId ?? "");
      const tools = [
        ...next.tools.filter((t) => t.callId !== callId),
        {
          callId,
          name: String(payload.name ?? "tool"),
          args: payload.args,
          status: "running" as const,
        },
      ];
      return { ...next, tools };
    }
    case "tool.finished": {
      const callId = String(payload.callId ?? "");
      return {
        ...next,
        tools: next.tools.map((t) =>
          t.callId === callId
            ? { ...t, status: "succeeded" as const, result: payload.result }
            : t,
        ),
      };
    }
    case "tool.failed": {
      const callId = String(payload.callId ?? "");
      return {
        ...next,
        tools: next.tools.map((t) =>
          t.callId === callId
            ? { ...t, status: "failed" as const, error: String(payload.error ?? "") }
            : t,
        ),
      };
    }
    case "tool.retried": {
      const callId = String(payload.callId ?? "");
      return {
        ...next,
        tools: next.tools.map((t) =>
          t.callId === callId
            ? { ...t, status: "running" as const, error: undefined }
            : t,
        ),
      };
    }
    case "tool.args_edited": {
      const callId = String(payload.callId ?? "");
      return {
        ...next,
        tools: next.tools.map((t) =>
          t.callId === callId ? { ...t, args: payload.args } : t,
        ),
      };
    }
    case "diff.updated": {
      const files = Array.isArray(payload.files) ? (payload.files as FileDiff[]) : [];
      return { ...next, diffs: files };
    }
    case "preview.ready":
      return {
        ...next,
        preview: {
          ...next.preview,
          desktopHtml:
            typeof payload.desktopHtml === "string"
              ? payload.desktopHtml
              : next.preview.desktopHtml,
          mobileHtml:
            typeof payload.mobileHtml === "string"
              ? payload.mobileHtml
              : next.preview.mobileHtml,
        },
      };
    case "preview.sanitized":
      return {
        ...next,
        preview: {
          ...next.preview,
          sanitized: Array.isArray(payload.stripped)
            ? payload.stripped.map(String)
            : next.preview.sanitized,
        },
      };
    case "qa.finished": {
      const report = payload.report as QaReport | undefined;
      return {
        ...next,
        status: "awaiting_gate",
        qa: report ?? null,
        gatePending: true,
      };
    }
    case "gate.pending":
      return { ...next, status: "awaiting_gate", gatePending: true };
    case "gate.approved":
    case "run.completed":
      return { ...next, status: "completed", gatePending: false };
    case "gate.rejected":
      return {
        ...next,
        status: "failed",
        gatePending: false,
        error: String(payload.reason ?? "gate rejected"),
      };
    case "run.failed":
    case "run.step_limit":
      return {
        ...next,
        status: "failed",
        error: String(payload.message ?? payload.reason ?? event.type),
      };
    case "gate.edit_requested":
      return { ...next, status: "executing", gatePending: false };
    case "run.cancelled":
      return { ...next, status: "cancelled", gatePending: false };
    case "run.duplicate_blocked":
      return { ...next, duplicateBlocked: true };
    case "metrics.sample":
      return {
        ...next,
        metrics: {
          ttftMs: typeof payload.ttftMs === "number" ? payload.ttftMs : undefined,
          tokens: typeof payload.tokens === "number" ? payload.tokens : undefined,
          costUsd: typeof payload.costUsd === "number" ? payload.costUsd : undefined,
        },
      };
    case "trace.span":
      return {
        ...next,
        traces: [
          ...next.traces,
          {
            name: String(payload.name ?? "span"),
            start: Number(payload.start ?? 0),
            end: Number(payload.end ?? 0),
            attrs: payload.attrs,
          },
        ],
      };
    default:
      return next;
  }
}

export function applyEvents(state: RunState, events: unknown[]): RunState {
  return events.reduce<RunState>((acc, ev) => applyEvent(acc, ev), state);
}
