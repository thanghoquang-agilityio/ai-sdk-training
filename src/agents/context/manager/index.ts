import type { PromptVersion } from "@/agents/config/types";
import { MANAGER_SYSTEM_PROMPT_V1 } from "./system-v1";

/** All available prompt versions for the manager agent */
export const managerPromptVersions: Record<PromptVersion, string> = {
  v1: MANAGER_SYSTEM_PROMPT_V1,
};
