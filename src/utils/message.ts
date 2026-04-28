import type { UIMessage } from "ai";

export function getTextParts(message: UIMessage): string[] {
  return message.parts.flatMap((part) =>
    part.type === "text" ? [part.text] : [],
  );
}
