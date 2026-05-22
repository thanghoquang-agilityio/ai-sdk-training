"use client";

import { useSyncExternalStore, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { ProviderSelector } from "@/components/chat/provider-selector";
import { ChatComposer } from "@/components/chat/composer";
import { DateRangePickerCard } from "@/components/chat/date-range-picker-card";
import { ChatTranscript } from "@/components/transcript";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { AuthPanel } from "@/components/workspace/auth-panel";
import { ThreadSidebar } from "@/components/workspace/sidebar";
import { APP_NAME, APP_HEADER_REVIEW_BADGE_LABEL } from "@/constants/app";
import { CHAT_COMPOSER_COPY } from "@/constants/chat";
import { DEFAULT_PROVIDER_OPTIONS } from "@/constants/provider";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";
import { isProductionLike } from "@/lib/runtime-env";
import type { AIProviderName } from "@/lib/ai-provider";
import { Text } from "@/components/ui/text";
import { getInitialsFromName } from "@/utils/avatar";
import { AUTH_HEADER } from "@/constants/auth";
import { useProviderSelection } from "@/hooks/use-provider";
import { useWorkspaceApp } from "@/hooks/use-workspace-app";
import { useHumanInTheLoop } from "@/hooks/use-human-in-the-loop";

const ALLOWED_PROVIDERS: AIProviderName[] = isProductionLike()
  ? ["openai"]
  : DEFAULT_PROVIDER_OPTIONS;

type WorkspaceAppProps = {
  authRole?: AppRole;
  authSessions: Record<AppRole, MockAuthSession>;
};

export function WorkspaceApp({
  authRole = "user",
  authSessions,
}: WorkspaceAppProps) {
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isHydrated) {
    return (
      <main className="min-h-screen min-h-dvh px-3 py-3 sm:px-5 sm:py-5">
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] min-h-[calc(100dvh-1.5rem)] w-full max-w-[1600px] flex-col gap-3 sm:min-h-[calc(100vh-2.5rem)] sm:min-h-[calc(100dvh-2.5rem)] sm:gap-4 lg:flex-row">
          <div className="h-[70vh] w-full rounded-[1.75rem] border border-white/9 bg-[linear-gradient(170deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] backdrop-blur-[28px] lg:max-w-sm" />
          <div className="h-[70vh] flex-1 rounded-[1.75rem] border border-white/9 bg-[linear-gradient(170deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] backdrop-blur-[28px]" />
        </div>
      </main>
    );
  }

  return <WorkspaceAppClient authRole={authRole} authSessions={authSessions} />;
}

function WorkspaceAppClient({ authRole, authSessions }: WorkspaceAppProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>(authRole ?? "user");
  const provider = useProviderSelection({ requireOpenAIApiKeyVerification: true });

  return (
    <CopilotKit
        runtimeUrl="/api/copilotkit"
        agent="leaveAssistant"
        headers={{ [AUTH_HEADER.role]: selectedRole }}
        properties={{
          provider: provider.requestBody.provider,
          ...(provider.requestBody.ollamaBaseUrl && {
            ollamaBaseUrl: provider.requestBody.ollamaBaseUrl,
          }),
        }}
      >
      {provider.successMessage ? (
        <Toast
          message={provider.successMessage}
          variant="success"
          onDismiss={provider.dismissSuccessMessage}
        />
      ) : null}
      <WorkspaceContent
        authSessions={authSessions}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        provider={provider}
      />
    </CopilotKit>
  );
}

type WorkspaceContentProps = {
  authSessions: Record<AppRole, MockAuthSession>;
  selectedRole: AppRole;
  setSelectedRole: (role: AppRole) => void;
  provider: ReturnType<typeof useProviderSelection>;
};

function WorkspaceContent({
  authSessions,
  selectedRole,
  setSelectedRole,
  provider,
}: WorkspaceContentProps) {
  const {
    input,
    setInput,
    auth,
    messages,
    isLoading,
    showDatePicker,
    thinkingLabel,
    canSend,
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
    handleSubmit,
    handlePromptSelect,
    handleRoleChange,
  } = useWorkspaceApp(authSessions, selectedRole, setSelectedRole, provider);

  const accountPanel = (
    <AuthPanel
      role={auth.role}
      session={auth.session}
      disabled={isLoading}
      onRoleChange={handleRoleChange}
    />
  );

  const sidebarProviderPanel = (
    <Card
      variant="panel"
      className="p-4 text-white shadow-[0_8px_30px_rgba(5,10,30,0.25)]"
    >
      <ProviderSelector
        provider={provider}
        allowedProviders={ALLOWED_PROVIDERS}
        withContainer={false}
      />
      {provider.validationError ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {provider.validationError}
        </p>
      ) : null}
    </Card>
  );

  const datePicker = showDatePicker ? (
    <DateRangePickerCard disabled={isLoading} onSubmit={handlePromptSelect} />
  ) : null;

  // Hide stale cards that survive a thread switch/delete because CopilotKit's
  // internal interrupt state isn't cleared when agent.setMessages([]) is called.
  const confirmCard = useHumanInTheLoop({
    agentId: "leaveAssistant",
    session: auth.session,
    isLoading,
    hasMessages: messages.length > 0,
  });

  return (
    <main className="min-h-screen min-h-dvh px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] min-h-[calc(100dvh-1.5rem)] w-full max-w-[1600px] flex-col gap-3 sm:min-h-[calc(100vh-2.5rem)] sm:min-h-[calc(100dvh-2.5rem)] sm:gap-4 lg:flex-row">
        <ThreadSidebar
          activeThread={activeThread}
          allThreads={allThreads}
          disabled={isLoading}
          accountPanel={accountPanel}
          providerPanel={sidebarProviderPanel}
          onSwitchThread={switchThread}
          onCreateThread={createNewThread}
          onDeleteThread={deleteThread}
        />

        <section className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/9 bg-[linear-gradient(170deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] backdrop-blur-[28px] shadow-[0_16px_60px_rgba(7,12,32,0.36)]">
          <header className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-5 sm:px-6 lg:px-8 shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.2)]">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Text as="p" variant="eyebrow">
                  {APP_NAME}
                </Text>
                <Badge size="md" variant="neutral">
                  {auth.session.roleLabel}
                </Badge>
                <Badge size="md" variant="brand">
                  {APP_HEADER_REVIEW_BADGE_LABEL}
                </Badge>
              </div>

              <div className="space-y-2">
                <Text
                  as="h2"
                  variant="title"
                  className="tracking-tight sm:text-[1.9rem]"
                >
                  {headerTitle}
                </Text>
                <Text variant="subtitle" className="max-w-2xl">
                  {headerSubtitle}
                </Text>
                {headerHint ? (
                  <Text variant="captionMuted" className="block">
                    {headerHint}
                  </Text>
                ) : null}
              </div>
            </div>
          </header>

          <ChatTranscript
            containerRef={messagesContainerRef}
            messages={messages}
            isLoading={isLoading}
            userAvatarUrl={auth.session.avatar}
            userAvatarLabel={`${auth.session.name} avatar`}
            userInitials={getInitialsFromName(auth.session.name)}
            quickActions={quickActions}
            onSelectPrompt={handlePromptSelect}
            datePicker={datePicker}
            confirmCard={confirmCard}
            thinkingLabel={thinkingLabel}
          />

          <ChatComposer
            input={input}
            canSend={canSend}
            isLoading={isLoading}
            isProviderReady={provider.isProviderReady}
            pendingApproval={!!confirmCard}
            inputTooltip={
              !provider.isProviderReady
                ? CHAT_COMPOSER_COPY.verifyProviderTooltip
                : undefined
            }
            helperText={helperText}
            errorMessage={null}
            onInputChange={setInput}
            onSubmitAction={handleSubmit}
          />
        </section>
      </div>
    </main>
  );
}
