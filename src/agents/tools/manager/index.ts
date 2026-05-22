import type { AgentToolFactoryMap } from "@/agents/config/types";
import { createManagerReadTools } from "./read";
import { createManagerMutationTools } from "./mutation";

/** Tool factories by category — consumed by the config registry */
export const managerToolFactories: AgentToolFactoryMap = {
  read: (session, _options, model) =>
    createManagerReadTools(session, model),
  mutation: (session) => createManagerMutationTools(session),
};
