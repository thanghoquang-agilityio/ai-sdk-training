import type { PromptVersion } from "@/agents/config/types";
import { EMPLOYEE_SYSTEM_PROMPT_V1 } from "./system-v1";

/** All available prompt versions for the employee agent */
export const employeePromptVersions: Record<PromptVersion, string> = {
  v1: EMPLOYEE_SYSTEM_PROMPT_V1,
  // When you create system-v2.ts, add here:
  // v2: EMPLOYEE_SYSTEM_PROMPT_V2,
};
