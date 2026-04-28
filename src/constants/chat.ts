import type { AppRole } from "@/lib/auth/session";
import type { QuickAction } from "@/types/chat";

export const CHAT_COMPOSER_COPY = {
  placeholder:
    "Ask about your balance, request time off, review approvals, or cancel a request...",
  ariaLabel: "Chat input",
  defaultHelperText: "Press Enter to send. Shift + Enter adds a new line.",
  submitHint: "Sending your message...",
  sendButtonLabel: "Send",
  thinkingButtonLabel: "Thinking...",
  verifyFirstButtonLabel: "Verify first",
  verifyProviderTooltip: "Please verify your OpenAI key first.",
} as const;

export const CHAT_THREAD_COPY = {
  idPrefix: "thread",
  defaultTitle: "New chat",
  emptyPreview: "No messages yet",
  titleMaxLength: 42,
  previewMaxLength: 72,
} as const;

export const CHAT_EMPTY_STATE_COPY = {
  title: "Manage your leave",
  description:
    "Ask for balances, review upcoming leave, create a new request, or cancel one when your schedule changes.",
} as const;

export const CHAT_STREAMING_PLACEHOLDER_TEXT = "Working on it...";

export const CHAT_HELPER_COPY_BY_ROLE: Record<AppRole, string> = {
  user: "Review your balance or requests first; leave changes now require a quick UI confirmation.",
  manager:
    "Review the pending queue first, then approve or reject with UI confirmation.",
};

export const QUICK_ACTIONS_BY_ROLE: Record<AppRole, QuickAction[]> = {
  user: [
    {
      label: "Check balance",
      prompt: "How many annual, sick, and personal leave days do I have left?",
    },
    {
      label: "Review pending",
      prompt: "List my pending time-off requests first.",
    },
    {
      label: "All requests",
      prompt: "Show all my time-off requests.",
    },
  ],
  manager: [
    {
      label: "Team pending",
      prompt: "Show my team's pending time-off requests.",
    },
    {
      label: "Review list employees",
      prompt: "List all members in my project.",
    },
  ],
};

export const CHAT_TRANSCRIPT_COPY = {
  defaultAgentName: "employee",
  userBadge: "You",
  assistantBadgeByAgent: {
    employee: "EM",
    manager: "MG",
    coordinator: "CO",
  },
  defaultAgentLabel: "Employee Agent",
  toolFallbackLabel: "Action",
  toolApproval: {
    selectedRequestFallback: "selected request",
    submitRequest: {
      title: "Confirm time-off request",
      confirmLabel: "Confirm request",
      cancelLabel: "Cancel",
    },
    cancelRequest: {
      title: "Confirm cancellation",
      descriptionPrefix: "Cancel request:",
      confirmLabel: "Confirm cancel",
      cancelLabel: "Keep request",
    },
    approveRequest: {
      title: "Confirm approval",
      descriptionPrefix: "Approve team request:",
      commentLabel: "Comment:",
      confirmLabel: "Confirm approve",
      cancelLabel: "Cancel",
    },
    rejectRequest: {
      title: "Confirm rejection",
      descriptionPrefix: "Reject team request:",
      reasonLabel: "Reason:",
      confirmLabel: "Confirm reject",
      cancelLabel: "Cancel",
    },
    default: {
      title: "Confirm action",
      description: "Please review this action before it runs.",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
    },
  },
  toolStatus: {
    confirmedSuffix: "confirmed. Executing...",
    cancelledSuffix: "cancelled.",
    failedSuffix: "failed.",
    completedSuffix: "completed.",
  },
} as const;

export function getQuickActionsByRole(role: AppRole) {
  return QUICK_ACTIONS_BY_ROLE[role];
}
