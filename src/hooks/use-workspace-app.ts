"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
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
} from "@/constants/chat";
import { useCopilotSuggestions } from "@/hooks/use-copilot-suggestions";
import { PROVIDER_HELPER_HINT_COPY } from "@/constants/provider";
import { useChatAutoScroll } from "@/hooks/use-auto-scroll";
import { useChatThreads } from "@/hooks/use-threads";
import { useCopilotReadable } from "@/hooks/use-copilot-readable";
import { useCopilotRoleInstructions } from "@/hooks/use-copilot-additional-instructions";
import type { UseProviderSelectionResult } from "@/types/provider";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";
import { agUIMessagesToUIMessages } from "@/utils/message-adapter";
import type { LeaveAssistantState } from "@/agents/core/events";

export function useWorkspaceApp(
  authSessions: Record<AppRole, MockAuthSession>,
  selectedRole: AppRole,
  setSelectedRole: (role: AppRole) => void,
  provider: UseProviderSelectionResult,
) {
  const [input, setInput] = useState("");
  const [frontendDatePicker, setFrontendDatePicker] = useState(false);
  const [localLeaveType, setLocalLeaveType] = useState<string | undefined>();

  const authSession = authSessions[selectedRole] ?? authSessions.user;
  const auth = useMemo(
    () => ({ role: selectedRole, session: authSession }),
    [authSession, selectedRole],
  );

  // openaiApiKey goes here only — must reach the agent but must not appear in
  // CopilotKit properties (GraphQL variables body).
  // Memoize so useAgentContext's internal useMemo([value]) only re-runs when
  // the content actually changes, not on every parent render.
  const agentContextValue = useMemo(() => {
    const config: Record<string, string> = {
      provider: provider.requestBody.provider,
      authRole: selectedRole,
    };
    if (provider.requestBody.openaiApiKey) {
      config.openaiApiKey = provider.requestBody.openaiApiKey;
    }
    if (provider.requestBody.ollamaBaseUrl) {
      config.ollamaBaseUrl = provider.requestBody.ollamaBaseUrl;
    }
    return config;
  }, [
    provider.requestBody.provider,
    provider.requestBody.openaiApiKey,
    provider.requestBody.ollamaBaseUrl,
    selectedRole,
  ]);

  useAgentContext({
    description:
      "Leave assistant configuration: provider type, API key, Ollama URL, and current user auth role",
    value: agentContextValue,
  });

  useCopilotReadable(authSession, selectedRole);
  useCopilotRoleInstructions(selectedRole);

  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: "leaveAssistant", throttleMs: 50 });

  const agentMessages = agent.messages as Message[];
  const isLoading = agent.isRunning;
  const agentState = agent.state as LeaveAssistantState | undefined;

  // Register collect_date_range as a frontend tool.
  // When the model calls it, CopilotKit executes this handler client-side —
  // no server TOOL_CALL_RESULT is emitted, so the handler fires via processAgentResult.
  useFrontendTool(
    {
      name: "collect_date_range",
      description:
        "Shows a date range picker to collect leave dates from the user. Call ONLY when the user provided no date information, or after a PAST_DATE validation error.",
      parameters: z.object({
        leaveType: z.enum(["annual", "sick", "personal", "unpaid"]).optional(),
        reason: z.string().optional(),
      }),
      handler: async ({ leaveType }) => {
        setLocalLeaveType(leaveType);
        setFrontendDatePicker(true);
        return {
          ok: true,
          message:
            "Date picker displayed. Waiting for user to select a date range.",
        };
      },
      followUp: false,
    },
    [],
  );

  // Phase-based label for the custom chat's loading indicator.
  const thinkingLabel = useMemo(() => {
    if (agentState?.phase === "routing") return "Routing";
    if (agentState?.phase === "resolving_dates") return "Resolving dates";
    if (agentState?.phase === "executing") return "Processing";
    return "Thinking";
  }, [agentState?.phase]);

  // Date picker is shown via:
  // 1. useFrontendTool handler — normal collect_date_range tool call path
  // 2. agentState.phase — past-date pre-stream path in ag-ui-employee.ts
  const lastAgentMessageRole = agentMessages[agentMessages.length - 1]?.role;
  const showDatePicker =
    agentMessages.length > 0 &&
    !isLoading &&
    lastAgentMessageRole !== "user" &&
    (frontendDatePicker || agentState?.phase === "awaiting_dates");

  const collectDateRangeLeaveType =
    localLeaveType ?? agentState?.collectDateRangeLeaveType;

  const messages = useMemo(
    () => agUIMessagesToUIMessages(agentMessages),
    [agentMessages],
  );

  const setAgentMessages = useMemo(
    () => (msgs: Message[]) => agent.setMessages(msgs),
    [agent],
  );

  const {
    activeThread,
    allThreads,
    switchThread: switchThreadRaw,
    createNewThread: createNewThreadRaw,
    deleteThread: deleteThreadRaw,
  } = useChatThreads({
    messages: agentMessages,
    setMessages: setAgentMessages,
    provider: provider.requestBody.provider,
    role: auth.role,
  });

  function resetDatePickerState() {
    setFrontendDatePicker(false);
    setLocalLeaveType(undefined);
  }

  function switchThread(id: string) {
    resetDatePickerState();
    switchThreadRaw(id);
  }

  function createNewThread() {
    resetDatePickerState();
    createNewThreadRaw();
  }

  function deleteThread(id: string) {
    resetDatePickerState();
    deleteThreadRaw(id);
  }

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const trimmedInput = input.trim();
  const canSend =
    trimmedInput.length > 0 && !isLoading && provider.isProviderReady;
  const isEmptyConversation = messages.length === 0;
  const quickActions = useCopilotSuggestions(auth.role);

  const headerTitle = isEmptyConversation
    ? getAppEmptyHeaderTitleByRole(auth.role)
    : (activeThread?.title ?? APP_NAME);
  const headerSubtitle = isEmptyConversation
    ? getAppSubtitleByRole(auth.role)
    : (activeThread?.preview ?? getAppSubtitleByRole(auth.role));
  const headerHint = isEmptyConversation
    ? getAppEmptyHeaderHintByRole(auth.role)
    : null;

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
    setFrontendDatePicker(false);
    setLocalLeaveType(undefined);

    try {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText,
      };
      agent.addMessage(userMsg);
      await copilotkit.runAgent({ agent });
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
    setFrontendDatePicker(false);
    setLocalLeaveType(undefined);
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
    thinkingLabel,
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
