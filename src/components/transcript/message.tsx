import { Fragment, memo, useMemo, useRef } from "react";
import { type UIMessage } from "ai";
import { LoadingIndicator } from "@/components/chat/loading-indicator";
import { MessageAvatar, MessageBubble } from "@/components/chat/message-bubble";
import { ToolOutputTable } from "@/components/chat/tool-output-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAvatarUrl, getInitialsFromName } from "@/utils/avatar";
import { getTextParts } from "@/utils/message";
import { formatIsoDateMessage } from "@/utils/date";
import {
  getToolParts,
  getToolStepText,
  getToolStatusCopy,
  getMutationSuccessCard,
  getAssistantInitials,
  readMessageMeta,
  TOOL_STATUS_TONE_CLASS,
  type MutationSuccessCard,
} from "./tool";
import { getToolOutputTables } from "./tool-output";
import {
  stripRedundantStructuredListText,
  shouldUseTableLeadInLayout,
  getRenderedTableLeadIns,
  extractTableLeadInFollowUp,
  splitTextBeforeAndAfterTables,
  getTableLeadInText,
} from "./text";
type TableWithKey = ReturnType<typeof getToolOutputTables>[number] & { key: string };

type SecondContentProps = {
  message: UIMessage;
  isUser: boolean;
  isLoading: boolean;
  isLastMessage: boolean;
  shouldRenderBubble: boolean;
  embedOutputTablesInBubble: boolean;
  text: string;
  visibleOutputTables: TableWithKey[];
  tableIds: string[];
  useTableLeadInLayout: boolean;
  textPlacement: { beforeTables: string; afterTables: string | null };
  shouldShowThinkingSkeleton: boolean;
  thinkingLabel: string;
  statusParts: { tone: "success" | "error" | "neutral"; text: string }[];
  onSelectPrompt: (prompt: string) => void;
};

const MessageSecondContent = memo(function MessageSecondContent({
  message, isUser, isLoading, isLastMessage, shouldRenderBubble, embedOutputTablesInBubble,
  text, visibleOutputTables, tableIds, useTableLeadInLayout, textPlacement,
  shouldShowThinkingSkeleton, thinkingLabel,
  statusParts, onSelectPrompt,
}: SecondContentProps) {
  const actionsDisabled = isLoading || !isLastMessage;
  return (
    <>
      {shouldRenderBubble ? (
        <MessageBubble isUser={isUser} text={text || undefined} fullWidth={embedOutputTablesInBubble}>
          {embedOutputTablesInBubble ? (
            <div className="space-y-3">
              {visibleOutputTables.map((table) => (
                <div key={table.key} className="space-y-2">
                  {useTableLeadInLayout ? (
                    <p className="font-dm-sans text-sm text-white/82">
                      {getTableLeadInText(table.id, tableIds)}
                    </p>
                  ) : null}
                  <ToolOutputTable title={table.title} columns={table.columns} rows={table.rows}
                    rowActions={table.rowActions} rowActionSummaries={table.rowActionSummaries}
                    onActionClick={onSelectPrompt} disableActions={actionsDisabled} emptyLabel={table.emptyLabel}
                  />
                </div>
              ))}
              {textPlacement.afterTables ? (
                <p className="whitespace-pre-wrap font-dm-sans text-sm text-white/78">
                  {textPlacement.afterTables}
                </p>
              ) : null}
            </div>
          ) : null}
        </MessageBubble>
      ) : null}
      {shouldShowThinkingSkeleton ? (
        <LoadingIndicator showAvatar={false} label={thinkingLabel} className="max-w-[72%]" />
      ) : null}
      {!embedOutputTablesInBubble && visibleOutputTables.length > 0 ? (
        <div className="mt-3 space-y-3">
          {visibleOutputTables.map((table) => (
            <ToolOutputTable key={table.key} title={table.title} columns={table.columns}
              rows={table.rows} rowActions={table.rowActions} rowActionSummaries={table.rowActionSummaries}
              onActionClick={onSelectPrompt} disableActions={actionsDisabled} emptyLabel={table.emptyLabel}
            />
          ))}
        </div>
      ) : null}
      {statusParts.length > 0 ? (
        <div className="mt-3 space-y-2">
          {statusParts.map((statusPart, index) => (
            <Card key={`${message.id}-status-${index}`}
              className={`px-4 py-3 text-sm leading-relaxed ${TOOL_STATUS_TONE_CLASS[statusPart.tone]}`}
            >
              {statusPart.text}
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
});

const MutationSuccessCardItem = memo(function MutationSuccessCardItem({ card }: { card: MutationSuccessCard }) {
  return (
    <div className="w-fit max-w-full overflow-hidden rounded-xl border border-emerald-400/28 bg-emerald-500/6">
      <div className="border-b border-emerald-400/20 bg-emerald-500/8 px-4 py-2">
        <p className="font-dm-sans text-sm font-semibold text-emerald-100">{card.title}</p>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar variant="user" src={card.employeeAvatar ?? getAvatarUrl(card.employeeName)}
            alt={`${card.employeeName} avatar`} initials={getInitialsFromName(card.employeeName)}
            size="sm" className="ring-emerald-400/20"
          />
          <div>
            <p className="font-dm-sans text-sm font-semibold leading-tight text-emerald-100">
              {card.employeeName}
            </p>
            {card.team ? (
              <p className="font-dm-sans text-xs leading-tight text-emerald-100/60">{card.team}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <Badge variant="success" className="px-2.5 py-0.5 text-xs">{card.leaveTypeLabel}</Badge>
          <span className="font-dm-sans text-xs text-emerald-100/80">{card.dateRange}</span>
          <span className="font-dm-sans text-xs text-emerald-100/80">
            {card.days} {card.days === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      {card.reviewComment ? (
        <div className="border-t border-emerald-400/15 px-4 py-2">
          <p className="font-dm-sans text-xs text-emerald-100/65">Comment: {card.reviewComment}</p>
        </div>
      ) : null}
    </div>
  );
});

type ChatMessageProps = {
  message: UIMessage;
  isLastMessage: boolean;
  isLoading: boolean;
  userAvatarUrl?: string;
  userAvatarLabel?: string;
  userInitials?: string;
  onSelectPrompt: (prompt: string) => void;
};

export const ChatMessage = memo(function ChatMessage({
  message, isLastMessage, isLoading, userAvatarUrl, userAvatarLabel,
  userInitials, onSelectPrompt,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const rawText = useMemo(() => getTextParts(message).join("\n").trim(), [message]);
  const toolParts = useMemo(() => getToolParts(message), [message]);

  const outputTables = useMemo(() => toolParts.flatMap((part, partIndex) =>
    getToolOutputTables(part).map((table) => ({
      ...table,
      key: `${message.id}-${part.toolCallId ?? partIndex}-${table.id}`,
    })),
  ), [message.id, toolParts]);

  const currentToolStep = useMemo(() => [...toolParts]
    .reverse()
    .map((part) => getToolStepText(part))
    .find((step): step is string => Boolean(step)), [toolParts]);

  const agentLabel = useMemo(() => readMessageMeta(message)?.agentLabel ?? null, [message]);
  const thinkingLabel = currentToolStep ?? (agentLabel ? `Assign: ${agentLabel}` : "Thinking");

  // Capture rawText.length at the moment this message first enters the loading state.
  // -1 = not currently being loaded as the last message.
  const loadingStartRawTextRef = useRef(-1);
  const isLastLoading = isLastMessage && isLoading;
  if (!isLastLoading) {
    loadingStartRawTextRef.current = -1;
  } else if (loadingStartRawTextRef.current === -1) {
    loadingStartRawTextRef.current = rawText.length;
  }

  const shouldDeferOutputTables = useMemo(() => {
    if (isUser || !isLastMessage || !isLoading) return false;
    // Defer only when loading started on an empty message (fresh generation).
    // If rawText was already populated when loading started, this is a completed
    // message briefly appearing as "last" — keep its tables visible to avoid flickering.
    return loadingStartRawTextRef.current === 0;
  // loadingStartRawTextRef is a ref; isLastMessage/isLoading are its change triggers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUser, isLastMessage, isLoading]);
  const visibleOutputTables = useMemo(() => shouldDeferOutputTables
    ? []
    : outputTables.filter((table) => table.rows.length > 0), [shouldDeferOutputTables, outputTables]);

  const embedOutputTablesInBubble = !isUser && visibleOutputTables.length > 0;
  const tableIds = useMemo(() => visibleOutputTables.map((table) => table.id), [visibleOutputTables]);
  const useTableLeadInLayout = useMemo(() => !isUser && shouldUseTableLeadInLayout(tableIds), [isUser, tableIds]);
  const renderedTableLeadIns = useMemo(() => useTableLeadInLayout ? getRenderedTableLeadIns(tableIds) : [], [useTableLeadInLayout, tableIds]);

  const normalizedText = useMemo(() =>
    !isUser && visibleOutputTables.length > 0
      ? stripRedundantStructuredListText(rawText)
      : rawText, [isUser, visibleOutputTables.length, rawText]);

  const tableLeadInFollowUp = useMemo(() => useTableLeadInLayout
    ? extractTableLeadInFollowUp(normalizedText, renderedTableLeadIns)
    : null, [useTableLeadInLayout, normalizedText, renderedTableLeadIns]);

  const shouldSplitTextAroundTables = !isUser && visibleOutputTables.length > 0 && !useTableLeadInLayout;
  const textPlacement = useMemo(() => useTableLeadInLayout
    ? { beforeTables: "", afterTables: tableLeadInFollowUp }
    : shouldSplitTextAroundTables
      ? splitTextBeforeAndAfterTables(normalizedText)
      : { beforeTables: normalizedText, afterTables: null }, [useTableLeadInLayout, tableLeadInFollowUp, shouldSplitTextAroundTables, normalizedText]);

  const text = textPlacement.beforeTables;
  const displayText = useMemo(() => isUser ? formatIsoDateMessage(text) : text, [isUser, text]);

  const shouldDeferSuccessCards = useMemo(() => {
    if (isUser || !isLastMessage || !isLoading) return false;
    // Wait for text to start streaming before revealing the success card.
    // This prevents the card from flashing in while the tool call is still in progress.
    return text.length === 0;
  }, [isUser, isLastMessage, isLoading, text.length]);

  const mutationSuccessCards = useMemo(() => shouldDeferSuccessCards
    ? []
    : toolParts
        .map((part, partIndex) => {
          const success = getMutationSuccessCard(part);
          if (!success) return null;
          return { ...success, key: `${message.id}-success-${part.toolCallId ?? partIndex}` } as MutationSuccessCard;
        })
        .filter((item): item is MutationSuccessCard => item !== null), [shouldDeferSuccessCards, toolParts, message.id]);

  const shouldShowThinkingSkeleton = useMemo(() => {
    if (isUser || !isLastMessage || !isLoading) return false;
    // Show thinking whenever no text has streamed yet (covers the gap between
    // tool result arriving and the first text token being emitted).
    return text.length === 0;
  }, [isUser, isLastMessage, isLoading, text.length]);

  const statusParts = useMemo(() => toolParts
    .map((part) => getToolStatusCopy(part))
    .filter((item) => item !== null), [toolParts]);

  const shouldRenderBubble = text.length > 0 || embedOutputTablesInBubble;

  const successCardContent = mutationSuccessCards.map((card) => (
    <MutationSuccessCardItem key={card.key} card={card} />
  ));

  const hasSecondContent =
    shouldRenderBubble ||
    shouldShowThinkingSkeleton ||
    (!embedOutputTablesInBubble && visibleOutputTables.length > 0) ||
    statusParts.length > 0;

  const secondContentProps: SecondContentProps = {
    message, isUser, isLoading, isLastMessage, shouldRenderBubble, embedOutputTablesInBubble,
    text: displayText, visibleOutputTables, tableIds, useTableLeadInLayout, textPlacement,
    shouldShowThinkingSkeleton, thinkingLabel,
    statusParts, onSelectPrompt,
  };

  const shouldSplitMessage = !isUser && mutationSuccessCards.length > 0 && hasSecondContent;

  if (shouldSplitMessage) {
    return (
      <Fragment key={message.id}>
        <article className="flex gap-3 justify-start">
          <MessageAvatar initials={getAssistantInitials(message)} isUser={false} />
          <div className="min-w-0 max-w-full flex-1">
            <div className="space-y-2">{successCardContent}</div>
          </div>
        </article>
        <article className="flex gap-3 justify-start">
          <MessageAvatar initials={getAssistantInitials(message)} isUser={false} />
          <div className="min-w-0 max-w-full flex-1">
            <MessageSecondContent {...secondContentProps} />
          </div>
        </article>
      </Fragment>
    );
  }

  return (
    <article key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? <MessageAvatar initials={getAssistantInitials(message)} isUser={false} /> : null}
      <div className={isUser ? "w-fit max-w-[85%]" : "min-w-0 max-w-full flex-1"}>
        {mutationSuccessCards.length > 0 ? (
          <div className="space-y-2">{successCardContent}</div>
        ) : null}
        {hasSecondContent ? (
          <div className={mutationSuccessCards.length > 0 ? "mt-3" : undefined}>
            <MessageSecondContent {...secondContentProps} />
          </div>
        ) : (!isUser && !isLoading && isLastMessage && mutationSuccessCards.length === 0) ? (
          <p className="font-dm-sans text-sm text-white/50">
            Something went wrong. Please try again.
          </p>
        ) : null}
      </div>
      {isUser ? (
        <MessageAvatar initials={userInitials ?? ""} isUser={true}
          avatarUrl={userAvatarUrl} avatarLabel={userAvatarLabel}
        />
      ) : null}
    </article>
  );
});
