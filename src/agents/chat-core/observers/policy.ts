import type { AgentRunPolicy } from "../types";

const DEFAULT_AGENT_STOP_STEP_COUNT = 6;
const DEFAULT_AGENT_TEMPERATURE = 0;
const DEFAULT_AGENT_MESSAGE_WINDOW = 14;
const DEFAULT_AGENT_MAX_RETRIES = 2;
const DEFAULT_AGENT_STREAM_CHUNK_DELAY_MS = 30;

/**
 * Reads finite number.
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function readFiniteNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads positive integer.
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function readPositiveInteger(value: string | undefined): number | undefined {
  const parsed = readFiniteNumber(value);

  if (typeof parsed !== "number") return undefined;
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;

  return parsed;
}

/**
 * Reads non negative integer.
 * @param {string | undefined} value
 * @returns {number | undefined}
 */
function readNonNegativeInteger(value: string | undefined): number | undefined {
  const parsed = readFiniteNumber(value);

  if (typeof parsed !== "number") return undefined;
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;

  return parsed;
}

/**
 * Resolves agent run policy.
 * @returns {AgentRunPolicy}
 */
export function resolveAgentRunPolicy(): AgentRunPolicy {
  const stopStepCount =
    readPositiveInteger(process.env.AGENT_STOP_STEP_COUNT) ??
    DEFAULT_AGENT_STOP_STEP_COUNT;

  const temperature =
    readFiniteNumber(process.env.AGENT_TEMPERATURE) ??
    DEFAULT_AGENT_TEMPERATURE;

  const messageWindow =
    readPositiveInteger(process.env.AGENT_MESSAGE_WINDOW) ??
    DEFAULT_AGENT_MESSAGE_WINDOW;

  const maxRetries =
    readNonNegativeInteger(process.env.AGENT_MAX_RETRIES) ??
    DEFAULT_AGENT_MAX_RETRIES;

  const maxOutputTokens = readPositiveInteger(
    process.env.AGENT_MAX_OUTPUT_TOKENS,
  );

  const streamChunkDelayMs =
    readNonNegativeInteger(process.env.AGENT_STREAM_CHUNK_DELAY_MS) ??
    DEFAULT_AGENT_STREAM_CHUNK_DELAY_MS;

  return {
    stopStepCount,
    temperature,
    messageWindow,
    maxRetries,
    maxOutputTokens,
    streamChunkDelayMs,
  };
}
