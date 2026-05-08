import type { MockAuthSession } from "@/lib/auth/session";
import type { AgentToolFactoryMap } from "@/agents/config/types";
import { createDateResolutionTool } from "./read/resolution";

/** Tool factories by category — consumed by the config registry */
export const dateToolFactories: AgentToolFactoryMap = {
  read: (session: MockAuthSession, options?: Record<string, unknown>, model?: any) =>
    createDateResolutionTool(session, model),
};
