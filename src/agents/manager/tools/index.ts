import type { MockAuthSession } from "@/lib/auth/session";
import type { AgentToolFactoryMap } from "@/agents/config/types";
import { createManagerReadTools } from "./read";
import { createManagerMutationTools } from "./mutation";

/** Tool factories by category — consumed by the config registry */
export const managerToolFactories: AgentToolFactoryMap = {
  read: (session: MockAuthSession, options?: Record<string, unknown>, model?: any) =>
    createManagerReadTools(session, model),
  mutation: (session: MockAuthSession) => createManagerMutationTools(session),
};
