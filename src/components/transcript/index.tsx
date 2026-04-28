import { type UIMessage } from "ai";
import { type RefObject } from "react";
import { LoadingIndicator } from "@/components/chat/loading-indicator";
import { ChatEmptyState } from "@/components/chat/empty-state";
import { CHAT_TRANSCRIPT_COPY } from "@/constants/chat";
import type { QuickAction } from "@/types/chat";
import { ChatMessage } from "./message";

type ChatTranscriptProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  messages: UIMessage[];
  isLoading: boolean;
  userAvatarUrl?: string;
  userAvatarLabel?: string;
  userInitials?: string;
  quickActions: QuickAction[];
  onSelectPrompt: (prompt: string) => void;
  onToolApproval: (id: string, approved: boolean) => void;
};

export function ChatTranscript({
  containerRef,
  messages,
  isLoading,
  userAvatarUrl,
  userAvatarLabel = "User avatar",
  userInitials = CHAT_TRANSCRIPT_COPY.userBadge,
  quickActions,
  onSelectPrompt,
  onToolApproval,
}: ChatTranscriptProps) {
  const lastMessage = messages.at(-1);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      {messages.length === 0 ? (
        <ChatEmptyState quickActions={quickActions} onSelectPrompt={onSelectPrompt} />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLastMessage={message.id === lastMessage?.id}
              isLoading={isLoading}
              userAvatarUrl={userAvatarUrl}
              userAvatarLabel={userAvatarLabel}
              userInitials={userInitials}
              onSelectPrompt={onSelectPrompt}
              onToolApproval={onToolApproval}
            />
          ))}

          {isLoading && lastMessage?.role === "user" ? (
            <LoadingIndicator label="Thinking" />
          ) : null}
        </div>
      )}
    </div>
  );
}
