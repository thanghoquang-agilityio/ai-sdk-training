import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { LeaveAssistantAgent } from "@/agents/chat-core/services/ag-ui-adapter";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({
  agents: {
    leaveAssistant: new LeaveAssistantAgent(),
  },
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime: copilotRuntime,
  endpoint: "/api/copilotkit",
});

export const GET = handleRequest;
export const POST = handleRequest;
