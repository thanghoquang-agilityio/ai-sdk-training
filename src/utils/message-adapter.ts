import type { Message } from "@ag-ui/core";
import type { UIMessage } from "ai";

type DynamicToolPart = Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>;

/**
 * Cache that maps each message ID to its last-converted UIMessage and its JSON hash.
 * This ensures stable React references even if the underlying Message objects are cloned.
 */
const uiMessageCache = new Map<string, { hash: string; ui: UIMessage }>();

function hashUIMessage(msg: UIMessage): string {
  return JSON.stringify(msg);
}

/**
 * Convert ag-ui Message[] to UIMessage[], preserving object references for
 * messages whose content hasn't changed. This is critical for React.memo on
 * ChatMessage to be effective.
 */
export function agUIMessagesToUIMessages(messages: Message[]): UIMessage[] {
  const result: UIMessage[] = [];
  const toolCallLocation = new Map<string, { msgIndex: number; partIndex: number }>();

  // First pass: collect assistant messages and build the base structure.
  let needsToolResultPass = false;

  for (const msg of messages) {
    if (msg.role === "user") {
      const content = typeof msg.content === "string" ? msg.content : "";
      const uiMsg: UIMessage = {
        id: msg.id,
        role: "user",
        parts: [{ type: "text" as const, text: content }],
      };
      result.push(uiMsg);
    } else if (msg.role === "assistant") {
      const parts: UIMessage["parts"] = [];

      if (msg.content) {
        parts.push({ type: "text" as const, text: msg.content });
      }

      if (msg.toolCalls) {
        for (const toolCall of msg.toolCalls) {
          const partIndex = parts.length;
          toolCallLocation.set(toolCall.id, { msgIndex: result.length, partIndex });

          let input: unknown = {};
          try {
            input = JSON.parse(toolCall.function.arguments);
          } catch {
            input = {};
          }

          parts.push({
            type: "dynamic-tool" as const,
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
            state: "input-available" as const,
            input,
          } as DynamicToolPart);
        }
      }

      if (parts.length > 0) {
        result.push({ id: msg.id, role: "assistant", parts });
      }
    } else if (msg.role === "tool") {
      needsToolResultPass = true;
    }
  }

  // Second pass: apply tool results
  if (needsToolResultPass) {
    for (const msg of messages) {
      if (msg.role !== "tool") continue;

      const location = toolCallLocation.get(msg.toolCallId);
      if (!location) continue;

      const targetMsg = result[location.msgIndex];
      const targetPart = targetMsg?.parts[location.partIndex] as DynamicToolPart | undefined;
      if (targetPart?.type !== "dynamic-tool") continue;

      let output: unknown;
      try {
        output = JSON.parse(msg.content);
      } catch {
        output = msg.content;
      }

      targetMsg.parts[location.partIndex] = {
        ...targetPart,
        state: "output-available" as const,
        output,
      } as DynamicToolPart;
    }
  }

  // Third pass: apply cache to preserve object references
  for (let i = 0; i < result.length; i++) {
    const fresh = result[i];
    const hash = hashUIMessage(fresh);
    const cached = uiMessageCache.get(fresh.id);

    if (cached && cached.hash === hash) {
      result[i] = cached.ui;
    } else {
      uiMessageCache.set(fresh.id, { hash, ui: fresh });
    }
  }

  // Cleanup: remove IDs that are no longer in the messages list to prevent memory leaks
  if (uiMessageCache.size > result.length + 20) {
    const currentIds = new Set(result.map((m) => m.id));
    for (const id of uiMessageCache.keys()) {
      if (!currentIds.has(id)) {
        uiMessageCache.delete(id);
      }
    }
  }

  return result;
}
