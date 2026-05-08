import type { ToolSet, LanguageModel } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import type {
  AgentConfig,
  AgentToolCategory,
  SpecialistAgentName,
} from "./types";
import {
  AGENT_CONFIG,
  PROMPT_VERSIONS,
  TOOL_FACTORIES,
  DESCRIPTIONS,
} from "./registry";

/** Resolve the system prompt for an agent based on its configured version */
export function resolveSystemPrompt(agent: SpecialistAgentName): string {
  const config = AGENT_CONFIG[agent];
  return PROMPT_VERSIONS[agent][config.promptVersion];
}

/**
 * Dynamically create the tool set for an agent.
 * Only includes the tool categories and specific tool names listed in the agent's config.
 */
export function resolveAgentTools(
  agent: SpecialistAgentName,
  session: MockAuthSession,
  options?: Record<string, unknown>,
  model?: LanguageModel,
): ToolSet {
  const config = AGENT_CONFIG[agent];
  const factories = TOOL_FACTORIES[agent];

  return Object.entries(config.tools).reduce<ToolSet>(
    (acc, [category, activeNames]) => {
      const factory = factories[category as AgentToolCategory];
      if (factory && activeNames) {
        const categoryTools = factory(session, options, model);
        // Filter: only include tools whose name is in the activeNames list
        Object.keys(categoryTools).forEach((name) => {
          if (activeNames.includes(name)) {
            acc[name] = categoryTools[name];
          }
        });
      }
      return acc;
    },
    {} as ToolSet,
  );
}

/**
 * Generates the ## Routing section for the system prompt dynamically
 * based on the active tools in the agent's config.
 */
export function resolveRoutingHints(agent: SpecialistAgentName): string {
  const config = AGENT_CONFIG[agent];
  const hints: string[] = ["## Routing"];

  Object.values(config.tools).forEach((names) => {
    names?.forEach((name) => {
      const description = DESCRIPTIONS[name as keyof typeof DESCRIPTIONS];
      if (description) {
        hints.push(`- ${description} -> ${name}`);
      }
    });
  });

  return hints.join("\n");
}

/**
 * Generates the ## Core behavior section for the system prompt dynamically
 * based on the 'flow' configured for the agent.
 */
export function resolveAgentFlow(agent: SpecialistAgentName): string {
  const config = AGENT_CONFIG[agent];
  if (!config.flow || config.flow.length === 0) return "";

  const lines = ["## Core behavior"];
  config.flow.forEach((instruction) => {
    lines.push(instruction.startsWith(" ") ? instruction : `- ${instruction}`);
  });

  return lines.join("\n");
}

/** Get the config for a specific agent */
export function getAgentConfig(agent: SpecialistAgentName): AgentConfig {
  return AGENT_CONFIG[agent];
}
