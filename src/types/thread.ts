import type { UIMessage } from "ai";
import type { AIProviderName } from "@/lib/ai-provider";

export type ChatThread = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  provider: AIProviderName;
  messages: UIMessage[];
};

export type SetChatMessages = (
  messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
) => void;
