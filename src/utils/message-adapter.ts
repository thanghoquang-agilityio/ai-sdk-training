import type { Message } from "@ag-ui/core";
import type { UIMessage } from "ai";

type DynamicToolPart = Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>;

export function agUIMessagesToUIMessages(messages: Message[]): UIMessage[] {
  const result: UIMessage[] = [];
  const toolCallLocation = new Map<string, { msgIndex: number; partIndex: number }>();

  for (const msg of messages) {
    if (msg.role === "user") {
      const content = typeof msg.content === "string" ? msg.content : "";
      result.push({
        id: msg.id,
        role: "user",
        parts: [{ type: "text" as const, text: content }],
      });
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
      const location = toolCallLocation.get(msg.toolCallId);
      if (location) {
        const targetMsg = result[location.msgIndex];
        const targetPart = targetMsg?.parts[location.partIndex] as DynamicToolPart | undefined;
        if (targetPart?.type === "dynamic-tool") {
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
    }
  }

  return result;
}
