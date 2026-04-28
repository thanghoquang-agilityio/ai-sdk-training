import type { AgentLogger } from "../types";

const RUN_STATS_LOG_ENV = "AGENT_RUN_STATS_LOG";
const LEGACY_RUN_STATS_LOG_ENV = "AGENT_TELEMETRY_LOG";

/**
 * Checks whether env enabled.
 * @param {string | undefined} value
 */
function isEnvEnabled(value: string | undefined) {
  return value?.trim() === "1";
}

/**
 * shouldLogger helper.
 */
function shouldLogger() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return (
    isEnvEnabled(process.env[RUN_STATS_LOG_ENV]) ||
    isEnvEnabled(process.env[LEGACY_RUN_STATS_LOG_ENV])
  );
}

/**
 * Writes one-line runtime stats for each agent response.
 * - Development: always logs
 * - Production: logs only when AGENT_RUN_STATS_LOG=1 (or legacy AGENT_TELEMETRY_LOG=1)
 */
export function logAgent(stats: AgentLogger) {
  if (!shouldLogger()) return;

  console.info("[agent-logger]", JSON.stringify(stats));
}
