import { type ReactNode } from "react";
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
  datePicker?: ReactNode;
  confirmCard?: ReactNode;
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
  datePicker,
  confirmCard,
}: ChatTranscriptProps) {
  const lastMessage = messages.at(-1);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      {messages.length === 0 && !datePicker && !confirmCard ? (
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
            />
          ))}

          {isLoading && lastMessage?.role === "user" ? (
            <LoadingIndicator label="Thinking" />
          ) : null}

          {datePicker ? (
            <div className="flex justify-start">
              {datePicker}
            </div>
          ) : null}

          {confirmCard ? (
            <div className="flex justify-start">
              {confirmCard}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
