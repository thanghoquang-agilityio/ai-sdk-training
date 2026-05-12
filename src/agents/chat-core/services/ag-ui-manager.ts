import { EventType, type BaseEvent, type CustomEvent } from "@ag-ui/core";
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
    onInterrupt: ({ name, args, label }) => {
      emitState(observer, {
        phase: "awaiting_confirmation",
        specialist: "manager",
        pendingTool: { name, args, specialist: "manager", label },
      });
      observer.next({
        type: EventType.CUSTOM,
        name: "on_interrupt",
        value: { toolName: name, args, label },
      } as CustomEvent);
    },
  });
}
