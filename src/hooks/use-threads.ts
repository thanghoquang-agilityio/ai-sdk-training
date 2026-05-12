"use client";

import type { Message } from "@ag-ui/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHAT_THREAD_COPY } from "@/constants/chat";
import { CHAT_STORAGE_KEYS } from "@/constants/storage";
import type { AIProviderName } from "@/lib/ai-provider";
import type { AppRole } from "@/lib/auth/session";
import type { ChatThread, SetChatMessages } from "@/types/thread";
import { local } from "@/utils/storage";

export type { ChatThread } from "@/types/thread";

type RoleThreadData = {
  threads: ChatThread[];
  activeId: string;
};

type StoredData = Record<AppRole, RoleThreadData>;

function createThreadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${CHAT_THREAD_COPY.idPrefix}-${Date.now()}`;
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function deriveTitle(messages: Message[]) {
  const firstUser = messages.find((m) => m.role === "user");
  const text =
    firstUser && typeof (firstUser as { content?: unknown }).content === "string"
      ? ((firstUser as { content: string }).content.trim())
      : "";
  return text
    ? truncate(text, CHAT_THREAD_COPY.titleMaxLength)
    : CHAT_THREAD_COPY.defaultTitle;
}

function derivePreview(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" || msg.role === "assistant") {
      const content = (msg as { content?: unknown }).content;
      if (typeof content === "string" && content.trim()) {
        return truncate(content.trim(), CHAT_THREAD_COPY.previewMaxLength);
      }
    }
  }
  return CHAT_THREAD_COPY.emptyPreview;
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

function parseStoredData(raw: string | null, provider: AIProviderName): StoredData {
  const defaultData = (): RoleThreadData => {
    const empty = createEmptyThread(provider);
    return { threads: [empty], activeId: empty.id };
  };

  const fallback: StoredData = {
    user: defaultData(),
    manager: defaultData(),
  };

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return fallback;

    const candidate = parsed as Partial<Record<AppRole, unknown>>;

    const extract = (role: AppRole): RoleThreadData => {
      const data = candidate[role] as Partial<RoleThreadData> | undefined;
      if (!data || !Array.isArray(data.threads) || typeof data.activeId !== "string") {
        return defaultData();
      }
      const validThreads = data.threads.filter(isChatThread);
      if (validThreads.length === 0) return defaultData();

      const activeId = validThreads.some((t) => t.id === data.activeId)
        ? data.activeId
        : validThreads[0].id;

      return { threads: validThreads, activeId };
    };

    return {
      user: extract("user"),
      manager: extract("manager"),
    };
  } catch {
    return fallback;
  }
}

function updateThreadInList(
  threads: ChatThread[],
  id: string,
  updates: Partial<ChatThread>,
): ChatThread[] {
  return threads.map((t) => (t.id === id ? { ...t, ...updates } : t));
}

export function useChatThreads({
  messages,
  setMessages,
  provider,
  role,
}: {
  messages: Message[];
  setMessages: SetChatMessages;
  provider: AIProviderName;
  role: AppRole;
}) {
  const [data, setData] = useState<StoredData>(() =>
    parseStoredData(local.read(CHAT_STORAGE_KEYS.threadsByRole), provider),
  );

  const previousRoleRef = useRef(role);
  const isInternalChangeRef = useRef(false);

  // Sync messages from agent to the active thread in state
  useEffect(() => {
    if (isInternalChangeRef.current) return;

    setData((prev) => {
      const roleData = prev[role];
      const activeThread = roleData.threads.find((t) => t.id === roleData.activeId);
      if (!activeThread) return prev;

      const hasMessages = messages.length > 0;
      const nextThread: ChatThread = {
        ...activeThread,
        messages,
        title: hasMessages ? deriveTitle(messages) : activeThread.title,
        preview: hasMessages ? derivePreview(messages) : activeThread.preview,
        updatedAt: hasMessages ? new Date().toISOString() : activeThread.updatedAt,
        provider,
      };

      if (
        JSON.stringify(activeThread.messages) === JSON.stringify(messages) &&
        activeThread.provider === provider
      ) {
        return prev;
      }

      return {
        ...prev,
        [role]: {
          ...roleData,
          threads: updateThreadInList(roleData.threads, roleData.activeId, nextThread),
        },
      };
    });
  }, [messages, provider, role]);

  // Handle role switching
  useEffect(() => {
    if (previousRoleRef.current === role) return;

    previousRoleRef.current = role;

    const nextRoleData = data[role];
    const nextActiveThread = nextRoleData.threads.find((t) => t.id === nextRoleData.activeId);

    if (nextActiveThread) {
      isInternalChangeRef.current = true;
      setMessages(nextActiveThread.messages);
      setTimeout(() => {
        isInternalChangeRef.current = false;
      }, 0);
    }
  }, [role, data, setMessages]);

  // Persist to storage
  useEffect(() => {
    local.write(CHAT_STORAGE_KEYS.threadsByRole, JSON.stringify(data));
  }, [data]);

  const activeThread = useMemo(() => {
    const roleData = data[role];
    return roleData.threads.find((t) => t.id === roleData.activeId)!;
  }, [data, role]);

  const allThreads = useMemo(() => data[role].threads, [data, role]);

  function switchThread(id: string) {
    if (id === data[role].activeId) return;

    setData((prev) => ({
      ...prev,
      [role]: { ...prev[role], activeId: id },
    }));

    const nextThread = data[role].threads.find((t) => t.id === id);
    if (nextThread) {
      isInternalChangeRef.current = true;
      setMessages(nextThread.messages);
      setTimeout(() => {
        isInternalChangeRef.current = false;
      }, 0);
    }
  }

  function createNewThread() {
    const newThread = createEmptyThread(provider);
    setData((prev) => ({
      ...prev,
      [role]: {
        threads: [newThread, ...prev[role].threads],
        activeId: newThread.id,
      },
    }));

    isInternalChangeRef.current = true;
    setMessages([]);
    setTimeout(() => {
      isInternalChangeRef.current = false;
    }, 0);
  }

  function deleteThread(id: string) {
    setData((prev) => {
      const roleData = prev[role];
      const nextThreads = roleData.threads.filter((t) => t.id !== id);

      if (nextThreads.length === 0) {
        const empty = createEmptyThread(provider);
        return {
          ...prev,
          [role]: { threads: [empty], activeId: empty.id },
        };
      }

      let nextActiveId = roleData.activeId;
      if (id === roleData.activeId) {
        nextActiveId = nextThreads[0].id;
      }

      return {
        ...prev,
        [role]: { threads: nextThreads, activeId: nextActiveId },
      };
    });

    if (id === data[role].activeId) {
      const roleData = data[role];
      const nextThreads = roleData.threads.filter((t) => t.id !== id);
      const nextActiveThread = nextThreads.length > 0 ? nextThreads[0] : null;

      isInternalChangeRef.current = true;
      setMessages(nextActiveThread ? nextActiveThread.messages : []);
      setTimeout(() => {
        isInternalChangeRef.current = false;
      }, 0);
    }
  }

  return {
    activeThread,
    allThreads,
    switchThread,
    createNewThread,
    deleteThread,
  };
}
