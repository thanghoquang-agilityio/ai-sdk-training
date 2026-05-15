import type { UIMessage } from "ai";
import { getTextParts } from "@/utils/message";

const OLDER_CONTEXT_LINE_MAX_CHARS = 220;
const OLDER_CONTEXT_TOTAL_MAX_CHARS = 1400;
const OLDER_CONTEXT_LINE_WINDOW = 10;

type ConversationRuntimeContextInput = {
  messages: UIMessage[];
  messageWindow: number;
};

type RuntimeSystemPromptInput = {
  baseSystemPrompt: string;
  latestUserText: string;
  olderContextSummary: string | null;
  hasCompactedHistory: boolean;
};

function compactText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

function toRoleLabel(role: UIMessage["role"]): string {
  return role === "assistant" ? "Assistant" : "User";
}

function extractMessageText(message: UIMessage): string {
  return getTextParts(message).join(" ").trim();
}

function buildOlderContextSummary(messages: UIMessage[]): string | null {
  const lines = messages
    .map((message) => {
      const text = extractMessageText(message);
      if (!text) return null;

      return `${toRoleLabel(message.role)}: ${compactText(
        text,
        OLDER_CONTEXT_LINE_MAX_CHARS,
      )}`;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return null;
  }

  const recentLines = lines.slice(-OLDER_CONTEXT_LINE_WINDOW);
  const summary = recentLines.join("\n");

  if (summary.length <= OLDER_CONTEXT_TOTAL_MAX_CHARS) {
    return summary;
  }

  return `...${summary.slice(-(OLDER_CONTEXT_TOTAL_MAX_CHARS - 3))}`;
}

function getLatestUserText(messages: UIMessage[]): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return "none";
  }

  const text = extractMessageText(latestUserMessage);
  return text || "none";
}

export function buildConversationRuntimeContext(
  input: ConversationRuntimeContextInput,
) {
  const trimmedWindow = Math.max(1, input.messageWindow);
  const hasCompactedHistory = input.messages.length > trimmedWindow;
  const recentMessages = hasCompactedHistory
    ? input.messages.slice(-trimmedWindow)
    : input.messages;
  const olderMessages = hasCompactedHistory
    ? input.messages.slice(0, input.messages.length - trimmedWindow)
    : [];

  return {
    latestUserText: getLatestUserText(input.messages),
    recentMessages,
    olderContextSummary: buildOlderContextSummary(olderMessages),
    hasCompactedHistory,
  };
}

export function buildRuntimeSystemPrompt(input: RuntimeSystemPromptInput): string {
  const runtimeNotes = [
    "## Runtime execution notes",
    `- Latest user intent: ${input.latestUserText}`,
  ];

  if (input.hasCompactedHistory && input.olderContextSummary) {
    runtimeNotes.push(
      "- Older conversation was compacted for token efficiency. Use this summary for continuity:",
      input.olderContextSummary,
    );
  }

  return `${input.baseSystemPrompt.trim()}\n\n${runtimeNotes.join("\n")}`.trim();
}
