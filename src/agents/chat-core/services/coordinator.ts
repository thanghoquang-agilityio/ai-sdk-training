import type { UIMessage } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import type { CoordinatorDecision } from "../types";
import { getTextParts } from "@/utils/message";

const MANAGER_INTENT_PATTERNS = [
  /\bapprove\b/i,
  /\breject\b/i,
  /\bteam\b/i,
  /\bdirect\s+report/i,
  /\bcoverage\b/i,
  /\bapproval/i,
  /\bemployee[s]?\b/i,
  /\bmembers?\b/i,
  /\bproject\b/i,
];

type RouteConversationInput = {
  messages: UIMessage[];
  session: MockAuthSession;
};

/**
 * Gets latest user text.
 * @param {UIMessage[]} messages
 * @returns {string}
 */
function getLatestUserText(messages: UIMessage[]): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!latestUserMessage) return "";
  return getTextParts(latestUserMessage).join(" ").trim();
}

/**
 * Checks whether managed employee reference exists.
 * @param {MockAuthSession} session
 * @param {string} text
 */
function hasManagedEmployeeReference(session: MockAuthSession, text: string) {
  const normalized = text.toLowerCase();

  return session.managedEmployees.some((employee) =>
    [employee.name, employee.email, employee.employeeId]
      .map((v) => v.toLowerCase())
      .some((token) => normalized.includes(token)),
  );
}

/**
 * routeConversation helper.
 * @param {RouteConversationInput} input
 * @returns {CoordinatorDecision}
 */
export function routeConversation(input: RouteConversationInput): CoordinatorDecision {
  const latestUserText = getLatestUserText(input.messages);
  const isManagerIntent =
    MANAGER_INTENT_PATTERNS.some((p) => p.test(latestUserText)) ||
    hasManagedEmployeeReference(input.session, latestUserText);

  if (!isManagerIntent) {
    return { type: "delegate", specialist: "employee" };
  }

  if (input.session.role !== "manager") {
    return {
      type: "deny",
      message:
        "Manager actions are only available in manager mode. Switch to Manager mode in the sidebar, then try again.",
    };
  }

  return { type: "delegate", specialist: "manager" };
}
