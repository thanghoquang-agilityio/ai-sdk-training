import type { BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { LanguageModel, UIMessage } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import { buildManagerConversationPrompt } from "@/agents/manager/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { emitState } from "./ag-ui-types";
import { streamSpecialistEvents } from "./ag-ui-stream";

export async function runManagerFlow(
  observer: Observer<BaseEvent>,
  runId: string,
  uiMessages: UIMessage[],
  session: MockAuthSession,
  model: LanguageModel,
): Promise<void> {
  emitState(observer, { phase: "executing", specialist: "manager" });

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages,
    baseSystemPrompt: buildManagerConversationPrompt(session),
    tools: resolveAgentTools("manager", session, undefined, model),
  });
}
