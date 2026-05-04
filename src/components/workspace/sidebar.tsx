import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { SIDEBAR_COPY } from "@/constants/app";
import {
  THREAD_TIMESTAMP_FORMAT,
  THREAD_TIMESTAMP_LOCALE,
} from "@/constants/date-time";
import { cn } from "@/utils/class-name";
import type { ChatThread } from "@/types/thread";

function formatTimestamp(value: string) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      THREAD_TIMESTAMP_LOCALE,
      THREAD_TIMESTAMP_FORMAT,
    ).format(new Date(value));
  } catch {
    return value;
  }
}

type ThreadSidebarProps = {
  activeThread: ChatThread;
  allThreads: ChatThread[];
  disabled?: boolean;
  accountPanel: ReactNode;
  providerPanel: ReactNode;
  onSwitchThread: (id: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (id: string) => void;
};

export function ThreadSidebar({
  activeThread,
  allThreads,
  disabled = false,
  accountPanel,
  providerPanel,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
}: ThreadSidebarProps) {
  return (
    <aside className="flex w-full flex-col rounded-[1.75rem] border border-white/9 bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] text-white backdrop-blur-[28px] shadow-[0_16px_60px_rgba(7,12,32,0.32)] lg:max-w-sm">
      <div className="border-b border-white/8 p-5">
        <div className="space-y-1">
          <Text as="p" variant="eyebrow">
            {SIDEBAR_COPY.eyebrow}
          </Text>
          <Text as="h1" variant="title">
            {SIDEBAR_COPY.title}
          </Text>
          <Text variant="captionStrong">
            {SIDEBAR_COPY.description}
          </Text>
        </div>
      </div>

      <div className="border-b border-white/8 p-5">{accountPanel}</div>

      <div className="border-b border-white/8 p-5">{providerPanel}</div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-4 px-2">
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center gap-2"
            onClick={onCreateThread}
            disabled={disabled || activeThread.messages.length === 0}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            {SIDEBAR_COPY.newChatLabel}
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 px-2">
              <Text as="p" variant="eyebrowMuted">
                {SIDEBAR_COPY.currentChatLabel}
              </Text>
            </div>
            <ThreadCard
              thread={activeThread}
              isActive
              disabled={disabled}
              onSelect={() => {}}
              onDelete={() => onDeleteThread(activeThread.id)}
            />
          </div>

          {(() => {
            const recentThreads = allThreads.filter(
              (t) => t.id !== activeThread.id && t.messages.length > 0,
            );
            if (recentThreads.length === 0) return null;

            return (
              <div>
                <div className="mb-2 px-2">
                  <Text as="p" variant="eyebrowMuted">
                    {SIDEBAR_COPY.recentChatsLabel}
                  </Text>
                </div>
                <div className="space-y-2">
                  {recentThreads.map((thread) => (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      disabled={disabled}
                      onSelect={() => onSwitchThread(thread.id)}
                      onDelete={() => onDeleteThread(thread.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </aside>
  );
}

function ThreadCard({
  thread,
  isActive = false,
  disabled = false,
  onSelect,
  onDelete,
}: {
  thread: ChatThread;
  isActive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      variant={isActive ? "soft" : "panel"}
      className={cn(
        "group cursor-pointer border-white/10 transition hover:border-white/16 hover:bg-white/9",
        isActive ? "bg-white/10 shadow-[0_8px_26px_rgba(8,12,30,0.22)]" : "bg-white/4",
      )}
      onClick={onSelect}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Text as="p" variant="bodyStrong" className="truncate">
              {thread.title}
            </Text>
            <Text variant="caption" className="mt-1 line-clamp-1">
              {thread.preview}
            </Text>
          </div>
          <Badge
            variant={isActive ? "brand" : "subtle"}
            size="sm"
            className="uppercase tracking-wide"
          >
            {thread.provider}
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Text variant="helper" suppressHydrationWarning>
            {formatTimestamp(thread.updatedAt)}
          </Text>
          <button
            type="button"
            className="font-dm-sans text-[10px] uppercase tracking-wider text-white/30 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={disabled}
          >
            {SIDEBAR_COPY.deleteChatLabel}
          </button>
        </div>
      </div>
    </Card>
  );
}
