import type { PromptVersion } from "@/agents/config/types";
import { DATE_AGENT_SYSTEM_PROMPT_V1 } from "./system-v1";

/** All available prompt versions for the date agent */
export const datePromptVersions: Record<PromptVersion, string> = {
  v1: DATE_AGENT_SYSTEM_PROMPT_V1,
};
