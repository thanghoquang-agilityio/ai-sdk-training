import type { UIMessage } from "ai";

export function getTextParts(message: UIMessage): string[] {
  return message.parts.flatMap((part) =>
    part.type === "text" ? [part.text] : [],
  );
}

export function getLatestUserText(messages: UIMessage[]): string {
  const latest = [...messages].reverse().find((m) => m.role === "user");
  if (!latest) return "";
  return getTextParts(latest).join(" ").trim();
}
