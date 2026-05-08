import { type LanguageModel } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import type { AgentToolFactoryMap } from "@/agents/config/types";
import { createEmployeeReadTools } from "./read";
import { createEmployeeMutationTools } from "./mutation";

export type EmployeeToolOptions = {
  skipDatePicker?: boolean;
};

/** Tool factories by category — consumed by the config registry */
export const employeeToolFactories: AgentToolFactoryMap = {
  read: (session: MockAuthSession, options?: Record<string, unknown>, model?: LanguageModel) =>
    createEmployeeReadTools(
      session,
      {
        skipDatePicker: Boolean(options?.skipDatePicker),
      },
      model,
    ),
  mutation: (session: MockAuthSession) => createEmployeeMutationTools(session),
};
