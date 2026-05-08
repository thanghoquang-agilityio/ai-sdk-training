import type { AgentToolFactoryMap } from "@/agents/config/types";
import { createCollectDateRangeTool } from "./read/collect";

/** Tool factories by category — consumed by the config registry */
export const dateToolFactories: AgentToolFactoryMap = {
  read: () => ({
    ...createCollectDateRangeTool(),
  }),
};
