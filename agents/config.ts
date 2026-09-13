/**
 * AI agent configuration.
 *
 * Importing `@openai/agents` installs the default OpenAI model provider
 * (reading `OPENAI_API_KEY`) and the default tracing exporter, so no global
 * setup is required. The model name honours `OPENAI_MODEL` with the SDK's
 * default (`gpt-5.6-luna`) as the fallback.
 */

export const AI_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";

/** Upper bound on turns per request — loop/abuse protection. */
export const MAX_AGENT_TURNS = 8;

/** Guards against unbounded tool loops inside a single turn. */
export const TOOL_CALL_LIMIT = 12;