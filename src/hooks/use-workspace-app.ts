"use client";

import {
  DefaultChatTransport,
  isToolUIPart,
} from "ai";
import { useChat } from "@ai-sdk/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { API_ROUTE_PATH } from "@/constants/api";
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
import { useProviderSelection } from "@/hooks/use-provider";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";
import { getDisplayErrorMessage } from "@/utils/error";

export function useWorkspaceApp(
  authRole: AppRole,
  authSessions: Record<AppRole, MockAuthSession>,
) {
  const [input, setInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>(authRole ?? "user");
  const autoSubmittedApprovalIdsRef = useRef<Set<string>>(new Set());
  const provider = useProviderSelection({
    requireOpenAIApiKeyVerification: true,
  });
  const authSession = authSessions[selectedRole] ?? authSessions.user;
  const auth = useMemo(
    () => ({
      role: selectedRole,
      session: authSession,
      requestBody: {
        authRole: selectedRole,
      },
    }),
    [authSession, selectedRole],
  );

  const chatRequestBodyRef = useRef({
    ...provider.requestBody,
    authRole: selectedRole,
  });
  useLayoutEffect(() => {
    chatRequestBodyRef.current = {
      ...provider.requestBody,
      authRole: selectedRole,
    };
  });

  // Transport is created once. Body reads from a ref so auto-submissions
  // (sendAutomaticallyWhen) always use the current role, not a stale closure.
  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: API_ROUTE_PATH.chat,
        body: () => chatRequestBodyRef.current,
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const {
    messages,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
    clearError,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      const lastMessage = messages.at(-1);

      if (!lastMessage || lastMessage.role !== "assistant") {
        return false;
      }

      const approvalResponses = lastMessage.parts
        .filter((part) => isToolUIPart(part) && part.state === "approval-responded")
        .map((part) => part.approval.id);

      if (approvalResponses.length === 0) {
        return false;
      }

      const hasNewApprovalResponse = approvalResponses.some(
        (id) => !autoSubmittedApprovalIdsRef.current.has(id),
      );

      if (!hasNewApprovalResponse) {
        return false;
      }

      approvalResponses.forEach((id) => {
        autoSubmittedApprovalIdsRef.current.add(id);
      });

      return true;
    },
  });
  const { activeThread, clearThread } = useChatThreads({
    messages,
    setMessages,
    provider: provider.selectedProvider,
    role: auth.role,
  });
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isSubmitting = status === "submitted";
  const isStreaming = status === "streaming";
  const isLoading = isSubmitting || isStreaming;
  const trimmedInput = input.trim();
  const canSend =
    trimmedInput.length > 0 && !isLoading && provider.isProviderReady;
  const requestError = error ? getDisplayErrorMessage(error) : null;
  const isEmptyConversation = messages.length === 0;
  const quickActions = useMemo(
    () => getQuickActionsByRole(auth.role),
    [auth.role],
  );
  const headerTitle = isEmptyConversation
    ? getAppEmptyHeaderTitleByRole(auth.role)
    : (activeThread?.title ?? APP_NAME);
  const headerSubtitle = isEmptyConversation
    ? getAppSubtitleByRole(auth.role)
    : (activeThread?.preview ?? getAppSubtitleByRole(auth.role));
  const headerHint = isEmptyConversation
    ? getAppEmptyHeaderHintByRole(auth.role)
    : null;

  useChatAutoScroll(messagesContainerRef, messages, isStreaming);

  useEffect(() => {
    if (!provider.validationError || requestError) {
      return;
    }

    clearError();
  }, [clearError, provider.validationError, requestError]);

  const previousRoleRef = useRef(auth.role);

  useEffect(() => {
    if (previousRoleRef.current === auth.role) {
      return;
    }

    previousRoleRef.current = auth.role;
    clearError();
  }, [auth.role, clearError]);

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
    clearError();

    try {
      await sendMessage(
        { text: messageText },
        {
          body: {
            ...provider.requestBody,
            ...auth.requestBody,
          },
        },
      );
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

  function handleToolApproval(id: string, approved: boolean) {
    clearError();
    void addToolApprovalResponse({ id, approved });
  }

  function handleRoleChange(role: AppRole) {
    if (role === selectedRole) {
      return;
    }

    clearError();
    setInput("");
    setMessages([]);
    autoSubmittedApprovalIdsRef.current.clear();
    setSelectedRole(role);
  }

  function handleDeleteChat() {
    clearError();
    setInput("");
    clearThread();
    autoSubmittedApprovalIdsRef.current.clear();
  }

  const helperText = useMemo(() => {
    if (isSubmitting) return CHAT_COMPOSER_COPY.submitHint;
    if (provider.isOpenAISelected && !provider.isOpenAIReady) {
      return PROVIDER_HELPER_HINT_COPY.verifyOpenAIFirst;
    }
    if (!provider.isOpenAISelected && !provider.isProviderReady) {
      return PROVIDER_HELPER_HINT_COPY.verifyOllamaFirst;
    }
    return CHAT_HELPER_COPY_BY_ROLE[auth.role];
  }, [
    auth.role,
    isSubmitting,
    provider.isOpenAIReady,
    provider.isOpenAISelected,
    provider.isProviderReady,
  ]);

  return {
    input,
    setInput,
    auth,
    provider,
    messages,
    isLoading,
    canSend,
    requestError,
    isEmptyConversation,
    quickActions,
    headerTitle,
    headerSubtitle,
    headerHint,
    helperText,
    messagesContainerRef,
    activeThread,
    submitTextMessage,
    handleSubmit,
    handlePromptSelect,
    handleToolApproval,
    handleRoleChange,
    handleDeleteChat,
  };
}
