import type { ToolSet, LanguageModel } from "ai";
import type { AgentName } from "@/agents/chat-core";
import type { MockAuthSession } from "@/lib/auth/session";

/** Prompt version follows file naming: system-v1.ts, system-v2.ts, etc. */
export type PromptVersion = "v1";

/** Tool categories that can be toggled per agent */
export type AgentToolCategory = "read" | "mutation";

/** Generic tool factory signature — all categories share this shape */
export type ToolFactory = (
  session: MockAuthSession,
  options?: Record<string, unknown>,
  model?: LanguageModel,
) => ToolSet;

/** Map of category → factory for a single agent */
export type AgentToolFactoryMap = Partial<
  Record<AgentToolCategory, ToolFactory>
>;

export type AgentConfig = {
  /** Which prompt version to use (maps to system-{version}.ts) */
  promptVersion: PromptVersion;
  /** Active tools organized by category */
  tools: Partial<Record<AgentToolCategory, string[]>>;
  /** Dynamic flow/behavior instructions */
  flow?: string[];
  /** Human-readable label */
  label: string;
};

/** Specialist agents (excludes coordinator) */
export type SpecialistAgentName = Exclude<AgentName, "coordinator">;

/** Central registry shape */
export type AgentConfigRegistry = Record<SpecialistAgentName, AgentConfig>;
