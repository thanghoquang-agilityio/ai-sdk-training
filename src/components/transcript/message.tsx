import { Fragment } from "react";
import { type UIMessage } from "ai";
import { LoadingIndicator } from "@/components/chat/loading-indicator";
import { MessageAvatar, MessageBubble } from "@/components/chat/message-bubble";
import { DateRangePickerCard } from "@/components/chat/date-range-picker-card";
import { ToolApprovalCard } from "@/components/chat/tool-approval-card";
import { ToolOutputTable } from "@/components/chat/tool-output-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAvatarUrl, getInitialsFromName } from "@/utils/avatar";
import { getTextParts } from "@/utils/message";
import {
  getToolParts,
  getToolStepText,
  isApprovalRequestedToolPart,
  isDatePickerToolPart,
  getDatePickerLeaveType,
  getApprovalCardContent,
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
  approvalParts: Extract<UIMessage["parts"][number], { approval: { id: string } }>[];
  datePickerParts: { key: string; leaveType: string }[];
  statusParts: { tone: "success" | "error" | "neutral"; text: string }[];
  onSelectPrompt: (prompt: string) => void;
  onToolApproval: (id: string, approved: boolean) => void;
};

function MessageSecondContent({
  message, isUser, isLoading, isLastMessage, shouldRenderBubble, embedOutputTablesInBubble,
  text, visibleOutputTables, tableIds, useTableLeadInLayout, textPlacement,
  shouldShowThinkingSkeleton, thinkingLabel, approvalParts, datePickerParts,
  statusParts, onSelectPrompt, onToolApproval,
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
      {approvalParts.length > 0 ? (
        <div className="mt-3 space-y-3">
          {approvalParts.map((part, index) => {
            const content = getApprovalCardContent(part);
            if (!content) return null;
            return (
              <ToolApprovalCard key={`${message.id}-approval-${part.toolCallId ?? index}`}
                title={content.title} description={content.description}
                confirmLabel={content.confirmLabel} cancelLabel={content.cancelLabel}
                onConfirm={() => onToolApproval(part.approval.id, true)}
                onCancel={() => onToolApproval(part.approval.id, false)}
              />
            );
          })}
        </div>
      ) : null}
      {datePickerParts.length > 0 ? (
        <div className="mt-3 space-y-3">
          {datePickerParts.map((part) => (
            <DateRangePickerCard
              key={part.key}
              disabled={isLoading}
              onSubmit={onSelectPrompt}
            />
          ))}
        </div>
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
}

function MutationSuccessCardItem({ card }: { card: MutationSuccessCard }) {
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
}

type ChatMessageProps = {
  message: UIMessage;
  isLastMessage: boolean;
  isLoading: boolean;
  userAvatarUrl?: string;
  userAvatarLabel?: string;
  userInitials?: string;
  onSelectPrompt: (prompt: string) => void;
  onToolApproval: (id: string, approved: boolean) => void;
};

export function ChatMessage({
  message, isLastMessage, isLoading, userAvatarUrl, userAvatarLabel,
  userInitials, onSelectPrompt, onToolApproval,
}: ChatMessageProps) {
  const rawText = getTextParts(message).join("\n").trim();
  const toolParts = getToolParts(message);
  const isUser = message.role === "user";
  const approvalParts = toolParts.filter(isApprovalRequestedToolPart);
  const datePickerParts = isLastMessage && !isLoading
    ? toolParts
        .filter(isDatePickerToolPart)
        .map((part, i) => ({
          key: `${message.id}-datepicker-${i}`,
          leaveType: getDatePickerLeaveType(part),
        }))
    : [];
  const outputTables = toolParts.flatMap((part, partIndex) =>
    getToolOutputTables(part).map((table) => ({
      ...table,
      key: `${message.id}-${part.toolCallId ?? partIndex}-${table.id}`,
    })),
  );
  const currentToolStep = [...toolParts]
    .reverse()
    .map((part) => getToolStepText(part))
    .find((step): step is string => Boolean(step));
  const agentLabel = readMessageMeta(message)?.agentLabel ?? null;
  const thinkingLabel = currentToolStep ?? (agentLabel ? `Assign: ${agentLabel}` : "Thinking");
  const shouldDeferOutputTables = !isUser && isLastMessage && isLoading;
  const visibleOutputTables = shouldDeferOutputTables
    ? []
    : outputTables.filter((table) => table.rows.length > 0);
  const embedOutputTablesInBubble = !isUser && visibleOutputTables.length > 0;
  const tableIds = visibleOutputTables.map((table) => table.id);
  const useTableLeadInLayout = !isUser && shouldUseTableLeadInLayout(tableIds);
  const renderedTableLeadIns = useTableLeadInLayout ? getRenderedTableLeadIns(tableIds) : [];
  const normalizedText =
    !isUser && visibleOutputTables.length > 0
      ? stripRedundantStructuredListText(rawText)
      : rawText;
  const tableLeadInFollowUp = useTableLeadInLayout
    ? extractTableLeadInFollowUp(normalizedText, renderedTableLeadIns)
    : null;
  const shouldSplitTextAroundTables = !isUser && visibleOutputTables.length > 0 && !useTableLeadInLayout;
  const textPlacement = useTableLeadInLayout
    ? { beforeTables: "", afterTables: tableLeadInFollowUp }
    : shouldSplitTextAroundTables
      ? splitTextBeforeAndAfterTables(normalizedText)
      : { beforeTables: normalizedText, afterTables: null };
  const text = textPlacement.beforeTables;
  // While the tool is still in-flight and no text has streamed yet, keep the skeleton visible.
  // Once loading ends (or text arrives), reveal the card.
  const shouldDeferSuccessCards = !isUser && isLastMessage && isLoading && text.length === 0;
  const mutationSuccessCards = shouldDeferSuccessCards
    ? []
    : toolParts
        .map((part, partIndex) => {
          const success = getMutationSuccessCard(part);
          if (!success) return null;
          return { ...success, key: `${message.id}-success-${part.toolCallId ?? partIndex}` } as MutationSuccessCard;
        })
        .filter((item): item is MutationSuccessCard => item !== null);
  const shouldShowThinkingSkeleton =
    !isUser && isLastMessage && isLoading && text.length === 0 && approvalParts.length === 0;
  const statusParts = toolParts
    .map((part) => getToolStatusCopy(part))
    .filter((item) => item !== null);
  const shouldRenderBubble = text.length > 0 || embedOutputTablesInBubble;

  // Render the rich success card content (reused in both split and single layouts).
  const successCardContent = mutationSuccessCards.map((card) => (
    <MutationSuccessCardItem key={card.key} card={card} />
  ));

  // The second part of the message: text bubble + table + status badges.
  const hasSecondContent =
    shouldRenderBubble ||
    shouldShowThinkingSkeleton ||
    approvalParts.length > 0 ||
    datePickerParts.length > 0 ||
    (!embedOutputTablesInBubble && visibleOutputTables.length > 0) ||
    statusParts.length > 0;

  const secondContentProps: SecondContentProps = {
    message, isUser, isLoading, isLastMessage, shouldRenderBubble, embedOutputTablesInBubble,
    text, visibleOutputTables, tableIds, useTableLeadInLayout, textPlacement,
    shouldShowThinkingSkeleton, thinkingLabel, approvalParts, datePickerParts,
    statusParts, onSelectPrompt, onToolApproval,
  };

  // When a mutation success card exists alongside other content, render
  // two separate visual messages so the card and the follow-up text/table
  // appear as distinct chat bubbles.
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
      <div className={`min-w-0 ${isUser ? "max-w-[85%]" : "max-w-full flex-1"}`}>
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
}
