import {
  createStaticAgentResponse,
  logAgent,
  routeConversation,
} from "@/agents/chat-core";
import { runManagerAgent } from "@/agents/manager/run";
import { runEmployeeAgent } from "@/agents/employee/run";
import { API_COMMON_ERROR_COPY, CHAT_API_COPY } from "@/constants/api";
import { isAppRole } from "@/lib/auth/session";
import { getMockAuthSession } from "@/lib/auth/session-store";
import {
  type ChatModelConfig,
  getChatModelCandidates,
  getSupportedAIProviderList,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import type { ChatApiRequestBody } from "@/types/api";
import { getErrorMessage } from "@/utils/error";

export const maxDuration = 60;
export const runtime = "nodejs";

const handleAgentLogger = logAgent;

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function parseProviderOverride(provider?: string): {
  providerOverride?: AIProviderName;
  errorMessage?: string;
} {
  const providerFromBody = provider?.trim().toLowerCase();

  if (!providerFromBody) {
    return {};
  }

  if (!isAIProviderName(providerFromBody)) {
    return {
      errorMessage: `${CHAT_API_COPY.invalidProviderPrefix} ${getSupportedAIProviderList()}.`,
    };
  }

  return { providerOverride: providerFromBody };
}

export async function POST(req: Request) {
  let body: ChatApiRequestBody;

  try {
    body = (await req.json()) as ChatApiRequestBody;
  } catch {
    return badRequest(API_COMMON_ERROR_COPY.invalidJsonBody);
  }

  if (!Array.isArray(body.messages)) {
    return badRequest(CHAT_API_COPY.invalidMessages);
  }

  const { providerOverride, errorMessage } = parseProviderOverride(
    body.provider,
  );
  if (errorMessage) {
    return badRequest(errorMessage);
  }

  const authRole = body.authRole?.trim().toLowerCase();
  const session = await getMockAuthSession(
    authRole && isAppRole(authRole) ? authRole : "user",
  );

  const normalizedOllamaBaseUrl = normalizeOllamaBaseUrl(body.ollamaBaseUrl);

  let modelConfig: ChatModelConfig;
  try {
    const candidates = getChatModelCandidates({
      provider: providerOverride,
      openaiApiKey: body.openaiApiKey,
      baseUrl:
        providerOverride === "ollama"
          ? (normalizedOllamaBaseUrl ?? undefined)
          : undefined,
    });
    modelConfig = candidates[0];
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }

  const coordinatorDecision = await routeConversation({
    model: modelConfig.model,
    messages: body.messages,
    session,
  });

  if (coordinatorDecision.type === "deny") {
    return createStaticAgentResponse({
      text: coordinatorDecision.message,
      agent: "coordinator",
      accessRole: session.role,
      originalMessages: body.messages,
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
    });
  }

  switch (coordinatorDecision.specialist) {
    case "manager":
      return runManagerAgent({
        model: modelConfig.model,
        modelId: modelConfig.modelId,
        provider: modelConfig.provider,
        messages: body.messages,
        session,
        onRunStats: handleAgentLogger,
      });
    case "employee":
      return runEmployeeAgent({
        model: modelConfig.model,
        modelId: modelConfig.modelId,
        provider: modelConfig.provider,
        messages: body.messages,
        session,
        onRunStats: handleAgentLogger,
      });
  }
}
