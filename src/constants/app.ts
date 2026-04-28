import type { AppRole } from "@/lib/auth/session";

export const APP_NAME = "Employee Assistant";
export const APP_METADATA_TITLE = APP_NAME;
export const APP_METADATA_DESCRIPTION =
  "A focused Next.js chat app for managing employee leave with OpenAI or Ollama.";
export const APP_ASSISTANT_AVATAR_SRC = "/chatbot-assistant-avatar.png";
export const APP_ASSISTANT_AVATAR_ALT = `${APP_NAME} avatar`;

export const APP_HEADER_SUBTITLE_BY_ROLE: Record<AppRole, string> = {
  user:
    "Review balances and upcoming requests first, then confirm leave changes safely when you're ready.",
  manager:
    "Review the team's leave queue first, then approve or reject safely with a quick confirmation step.",
};

export const APP_EMPTY_HEADER_TITLE_BY_ROLE: Record<AppRole, string> = {
  user: "Plan your time off with confidence",
  manager: "Review team leave with confidence",
};

export const APP_EMPTY_HEADER_HINT_BY_ROLE: Record<AppRole, string> = {
  user: "Start by reviewing your balance or upcoming requests.",
  manager: "Start by reviewing pending requests before taking action.",
};

export const SIDEBAR_COPY = {
  eyebrow: APP_NAME,
  title: "Employee assistant",
  description:
    "Your assistant for balance checks, requests, and team approvals.",
  currentChatLabel: "Current chat",
  deleteChatLabel: "Delete chat",
} as const;

export const APP_HEADER_REVIEW_BADGE_LABEL = "Review first";

export function getAppSubtitleByRole(role: AppRole) {
  return APP_HEADER_SUBTITLE_BY_ROLE[role];
}

export function getAppEmptyHeaderTitleByRole(role: AppRole) {
  return APP_EMPTY_HEADER_TITLE_BY_ROLE[role];
}

export function getAppEmptyHeaderHintByRole(role: AppRole) {
  return APP_EMPTY_HEADER_HINT_BY_ROLE[role];
}
