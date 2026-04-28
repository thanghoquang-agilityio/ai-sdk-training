"use client";

import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHAT_THREAD_COPY } from "@/constants/chat";
import { CHAT_STORAGE_KEYS } from "@/constants/storage";
import type { AIProviderName } from "@/lib/ai-provider";
import type { AppRole } from "@/lib/auth/session";
import type { ChatThread, SetChatMessages } from "@/types/thread";
import { local } from "@/utils/storage";
import { getTextParts } from "@/utils/message";

export type { ChatThread } from "@/types/thread";

type RoleThreads = Record<AppRole, ChatThread>;

function createThreadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${CHAT_THREAD_COPY.idPrefix}-${Date.now()}`;
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function deriveTitle(messages: UIMessage[]) {
  const firstUserText = messages.find((m) => m.role === "user");
  const text = firstUserText ? getTextParts(firstUserText).join(" ").trim() : "";
  return text
    ? truncate(text, CHAT_THREAD_COPY.titleMaxLength)
    : CHAT_THREAD_COPY.defaultTitle;
}

function derivePreview(messages: UIMessage[]) {
  const lastMessage = [...messages].reverse().find((m) => {
    const text = getTextParts(m).join(" ").trim();
    return text.length > 0;
  });

  if (!lastMessage) return CHAT_THREAD_COPY.emptyPreview;
  return truncate(
    getTextParts(lastMessage).join(" ").trim(),
    CHAT_THREAD_COPY.previewMaxLength,
  );
}

function createEmptyThread(provider: AIProviderName): ChatThread {
  const now = new Date().toISOString();
  return {
    id: createThreadId(),
    title: CHAT_THREAD_COPY.defaultTitle,
    preview: CHAT_THREAD_COPY.emptyPreview,
    createdAt: now,
    updatedAt: now,
    provider,
    messages: [],
  };
}

function isChatThread(candidate: unknown): candidate is ChatThread {
  if (!candidate || typeof candidate !== "object") return false;
  const t = candidate as Partial<ChatThread>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.preview === "string" &&
    typeof t.createdAt === "string" &&
    typeof t.updatedAt === "string" &&
    (t.provider === "openai" || t.provider === "ollama") &&
    Array.isArray(t.messages)
  );
}

function parseStoredThreads(raw: string | null): Partial<RoleThreads> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const candidate = parsed as Partial<Record<AppRole, unknown>>;
    return {
      user: isChatThread(candidate.user) ? candidate.user : undefined,
      manager: isChatThread(candidate.manager) ? candidate.manager : undefined,
    };
  } catch {
    return {};
  }
}

function createSnapshot(input: {
  baseThread: ChatThread;
  messages: UIMessage[];
  provider: AIProviderName;
}) {
  const { baseThread, messages, provider } = input;
  const hasMessages = messages.length > 0;

  return {
    ...baseThread,
    provider,
    messages,
    title: hasMessages ? deriveTitle(messages) : baseThread.title,
    preview: hasMessages ? derivePreview(messages) : baseThread.preview,
    updatedAt: hasMessages ? new Date().toISOString() : baseThread.updatedAt,
  } satisfies ChatThread;
}

function createInitialRoleThreads(provider: AIProviderName): RoleThreads {
  const parsed = parseStoredThreads(local.read(CHAT_STORAGE_KEYS.threadsByRole));
  return {
    user: parsed.user ?? createEmptyThread(provider),
    manager: parsed.manager ?? createEmptyThread(provider),
  };
}

export function useChatThreads({
  messages,
  setMessages,
  provider,
  role,
}: {
  messages: UIMessage[];
  setMessages: SetChatMessages;
  provider: AIProviderName;
  role: AppRole;
}) {
  const [storedThreads, setStoredThreads] = useState<RoleThreads>(() =>
    createInitialRoleThreads(provider),
  );
  const previousRoleRef = useRef(role);

  useEffect(() => {
    if (previousRoleRef.current === role) return;

    const previousRole = previousRoleRef.current;
    setStoredThreads((current) => ({
      ...current,
      [previousRole]: createSnapshot({
        baseThread: current[previousRole],
        messages,
        provider,
      }),
    }));

    previousRoleRef.current = role;
    setMessages(storedThreads[role].messages);
  }, [messages, provider, role, setMessages, storedThreads]);

  const activeThreadBase = storedThreads[role];

  const activeThread = useMemo(
    () => createSnapshot({ baseThread: activeThreadBase, messages, provider }),
    [activeThreadBase, messages, provider],
  );

  const threadsToPersist = useMemo(
    () => ({ ...storedThreads, [role]: activeThread }),
    [activeThread, role, storedThreads],
  );

  useEffect(() => {
    if (previousRoleRef.current !== role) return;
    local.write(CHAT_STORAGE_KEYS.threadsByRole, JSON.stringify(threadsToPersist));
  }, [role, threadsToPersist]);

  function clearThread() {
    const nextThread = createEmptyThread(provider);
    setStoredThreads((current) => ({ ...current, [role]: nextThread }));
    setMessages([]);
  }

  return { activeThread, clearThread };
}
