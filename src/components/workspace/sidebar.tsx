import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { SIDEBAR_COPY } from "@/constants/app";
import {
  THREAD_TIMESTAMP_FORMAT,
  THREAD_TIMESTAMP_LOCALE,
} from "@/constants/date-time";
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
  thread: ChatThread;
  disabled?: boolean;
  accountPanel: ReactNode;
  providerPanel: ReactNode;
  onDeleteThread: () => void;
};

export function ThreadSidebar({
  thread,
  disabled = false,
  accountPanel,
  providerPanel,
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
        <div className="mb-3 px-2">
          <Text as="p" variant="eyebrowMuted">
            {SIDEBAR_COPY.currentChatLabel}
          </Text>
        </div>

        <Card
          variant="soft"
          className="group border-white/10 bg-white/6 shadow-[0_8px_26px_rgba(8,12,30,0.22)] transition hover:border-white/16 hover:bg-white/9"
        >
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Text as="p" variant="bodyStrong" className="truncate">
                  {thread.title}
                </Text>
                <Text variant="caption" className="mt-1 line-clamp-2">
                  {thread.preview}
                </Text>
              </div>
              <Badge variant="subtle" size="sm" className="uppercase tracking-wide">
                {thread.provider}
              </Badge>
            </div>
            <Text
              variant="helper"
              className="mt-2 block"
              suppressHydrationWarning
            >
              {formatTimestamp(thread.updatedAt)}
            </Text>
          </div>

          <div className="px-4 pb-3">
            <button
              type="button"
              className="font-dm-sans text-xs text-white/55 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onDeleteThread}
              disabled={disabled}
            >
              {SIDEBAR_COPY.deleteChatLabel}
            </button>
          </div>
        </Card>
      </div>
    </aside>
  );
}
