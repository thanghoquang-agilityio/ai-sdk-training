"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useAgent, useAgentContext } from "@copilotkit/react-core/v2";
import type { Message } from "@ag-ui/core";
import {
  APP_NAME,
  getAppEmptyHeaderHintByRole,
  getAppEmptyHeaderTitleByRole,
  getAppSubtitleByRole,
} from "@/constants/app";
import {
  CHAT_COMPOSER_COPY,
  CHAT_HELPER_COPY_BY_ROLE,
  getQuickActionsByRole,
} from "@/constants/chat";
import { PROVIDER_HELPER_HINT_COPY } from "@/constants/provider";
import { useChatAutoScroll } from "@/hooks/use-auto-scroll";
import { useChatThreads } from "@/hooks/use-threads";
import type { UseProviderSelectionResult } from "@/types/provider";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";
import { agUIMessagesToUIMessages } from "@/utils/message-adapter";
import type { LeaveAssistantState } from "@/agents/chat-core/services/ag-ui-types";

export function useWorkspaceApp(
  authSessions: Record<AppRole, MockAuthSession>,
  selectedRole: AppRole,
  setSelectedRole: (role: AppRole) => void,
  provider: UseProviderSelectionResult,
) {
  const [input, setInput] = useState("");

  const authSession = authSessions[selectedRole] ?? authSessions.user;
  const auth = useMemo(
    () => ({ role: selectedRole, session: authSession }),
    [authSession, selectedRole],
  );

  useAgentContext({
    description: "Leave assistant configuration: provider type, API key, Ollama URL, and current user auth role",
    value: {
      provider: provider.requestBody.provider,
      openaiApiKey: provider.requestBody.openaiApiKey ?? null,
      ollamaBaseUrl: provider.requestBody.ollamaBaseUrl ?? null,
      authRole: selectedRole,
    },
  });

  const { agent } = useAgent({ agentId: "leaveAssistant" });

  const agentMessages = agent.messages as Message[];
  const isLoading = agent.isRunning;
  const agentState = agent.state as LeaveAssistantState | undefined;
  const showDatePicker = agentState?.phase === "awaiting_dates" && !isLoading;
  const collectDateRangeLeaveType = agentState?.collectDateRangeLeaveType;

  const messages = useMemo(
    () => agUIMessagesToUIMessages(agentMessages),
    [agentMessages],
  );

  const setAgentMessages = useMemo(
    () => (msgs: Message[]) => agent.setMessages(msgs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent],
  );

  const {
    activeThread,
    allThreads,
    switchThread,
    createNewThread,
    deleteThread,
  } = useChatThreads({
    messages: agentMessages,
    setMessages: setAgentMessages,
    provider: provider.requestBody.provider,
    role: auth.role,
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const trimmedInput = input.trim();
  const canSend = trimmedInput.length > 0 && !isLoading && provider.isProviderReady;
  const isEmptyConversation = messages.length === 0;
  const quickActions = useMemo(() => getQuickActionsByRole(auth.role), [auth.role]);

  const headerTitle = isEmptyConversation
    ? getAppEmptyHeaderTitleByRole(auth.role)
    : (activeThread?.title ?? APP_NAME);
  const headerSubtitle = isEmptyConversation
    ? getAppSubtitleByRole(auth.role)
    : (activeThread?.preview ?? getAppSubtitleByRole(auth.role));
  const headerHint = isEmptyConversation ? getAppEmptyHeaderHintByRole(auth.role) : null;

  useChatAutoScroll(messagesContainerRef, messages, isLoading);

  async function submitTextMessage(
    text: string,
    options?: { restoreInputOnError?: boolean },
  ) {
    const messageText = text.trim();
    if (!messageText) return;

    if (isLoading || !provider.isProviderReady) {
      setInput(messageText);
      return;
    }

    setInput("");

    try {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText,
      };
      agent.addMessage(userMsg);
    } catch {
      if (options?.restoreInputOnError ?? false) {
        setInput(messageText);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitTextMessage(trimmedInput, { restoreInputOnError: true });
  }

  async function handlePromptSelect(prompt: string) {
    await submitTextMessage(prompt, { restoreInputOnError: true });
  }

  function handleRoleChange(role: AppRole) {
    if (role === selectedRole) return;
    setInput("");
    agent.setMessages([]);
    setSelectedRole(role);
  }

  const helperText = useMemo(() => {
    if (isLoading) return CHAT_COMPOSER_COPY.submitHint;
    if (provider.isOpenAISelected && !provider.isOpenAIReady) {
      return PROVIDER_HELPER_HINT_COPY.verifyOpenAIFirst;
    }
    if (!provider.isOpenAISelected && !provider.isProviderReady) {
      return PROVIDER_HELPER_HINT_COPY.verifyOllamaFirst;
    }
    return CHAT_HELPER_COPY_BY_ROLE[auth.role];
  }, [
    auth.role,
    isLoading,
    provider.isOpenAIReady,
    provider.isOpenAISelected,
    provider.isProviderReady,
  ]);

  return {
    input,
    setInput,
    auth,
    messages,
    isLoading,
    agentState,
    showDatePicker,
    collectDateRangeLeaveType,
    canSend,
    isEmptyConversation,
    quickActions,
    headerTitle,
    headerSubtitle,
    headerHint,
    helperText,
    messagesContainerRef,
    activeThread,
    allThreads,
    switchThread,
    createNewThread,
    deleteThread,
    submitTextMessage,
    handleSubmit,
    handlePromptSelect,
    handleRoleChange,
  };
}
