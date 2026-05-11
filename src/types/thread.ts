import type { Message } from "@ag-ui/core";
import type { AIProviderName } from "@/lib/ai-provider";

export type ChatThread = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  provider: AIProviderName;
  messages: Message[];
};

export type SetChatMessages = (messages: Message[]) => void;
