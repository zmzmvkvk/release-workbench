/**
 * Live LLM adapter stub.
 * Wire with WORKBENCH_LLM=1 + API key secret. Until then, Worker SSE mock / client mock remain canonical.
 *
 * Protocol: same WorkbenchEvent envelope as docs/PROTOCOL.md
 */

export type LlmMode = "mock" | "live";

export function resolveLlmMode(env: {
  WORKBENCH_LLM?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}): LlmMode {
  if (env.WORKBENCH_LLM !== "1") return "mock";
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) return "mock";
  return "live";
}

/**
 * Placeholder: stream model tokens into stream.delta events.
 * Not called in production until secrets are set — keeps demos deterministic.
 */
export async function* liveStructuringPlaceholder(_input: {
  sources: { kind: string; text: string }[];
  signal?: AbortSignal;
}): AsyncGenerator<{ type: "stream.delta" | "requirements.ready"; payload: unknown }> {
  yield {
    type: "stream.delta",
    payload: {
      channel: "structuring",
      text: "[live stub] set WORKBENCH_LLM=1 and provider key to enable",
    },
  };
  yield {
    type: "requirements.ready",
    payload: { requirements: [], conflicts: [] },
  };
}
