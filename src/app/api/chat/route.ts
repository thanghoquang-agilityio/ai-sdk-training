import {
  createStaticAgentResponse,
  logAgent,
  routeConversation,
} from "@/agents/chat-core";
import { runManagerAgent } from "@/agents/manager/run";
import { runEmployeeAgent } from "@/agents/employee/run";
import { API_COMMON_ERROR_COPY, CHAT_API_COPY } from "@/constants/api";
import { isAppRole, type AppRole } from "@/lib/auth/session";
import { getMockAuthSession } from "@/lib/auth/session-store";
import { AUTH_HEADER } from "@/constants/auth";
import { type ChatModelConfig, getChatModelCandidates } from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import type { ChatApiRequestBody } from "@/types/api";
import { getErrorMessage } from "@/utils/error";
import { badRequest } from "@/utils/http";
import { parseProviderOverride } from "./utils";

export const maxDuration = 60;
export const runtime = "nodejs";

const handleAgentLogger = logAgent;

export async function POST(req: Request) {
  let body: ChatApiRequestBody;

  try {
    body = (await req.json()) as ChatApiRequestBody;
  } catch {
    return badRequest({ error: API_COMMON_ERROR_COPY.invalidJsonBody });
  }

  if (!Array.isArray(body.messages)) {
    return badRequest({ error: CHAT_API_COPY.invalidMessages });
  }

  const { providerOverride, errorMessage } = parseProviderOverride(
    body.provider,
  );
  if (errorMessage) {
    return badRequest({ error: errorMessage });
  }

  const rawRole = req.headers.get(AUTH_HEADER.resolvedRole) ?? "user";
  const session = await getMockAuthSession(
    isAppRole(rawRole) ? (rawRole as AppRole) : "user",
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
