import { generateObject } from "ai";
import type { LanguageModel, UIMessage } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import type { CoordinatorDecision } from "../types";
import { getTextParts } from "@/utils/message";

const routeSchema = z.object({
  specialist: z.enum(["employee", "manager", "out_of_scope"]),
});

type RouteConversationInput = {
  model: LanguageModel;
  messages: UIMessage[];
  session: MockAuthSession;
};

function getLatestUserText(messages: UIMessage[]): string {
  const latest = [...messages].reverse().find((m) => m.role === "user");
  if (!latest) return "";
  return getTextParts(latest).join(" ").trim();
}

function buildRoutingSystemPrompt(
  session: MockAuthSession,
  isOngoingConversation: boolean,
): string {
  const lines = [
    "You are a routing coordinator for a Leave Management system.",
    "Your job is to classify which specialist agent should handle the user's message, or identify if it is out of scope.",
    "IMPORTANT: Route based on the intent/meaning of the message regardless of what language it is written in.",
    "",
    "## Specialist Scopes",
    "- employee: Personal time-off queries (e.g., checking own leave balance, listing own requests, submitting or cancelling own leave).",
    "- manager: Team management (e.g., approving/rejecting requests for direct reports, listing team members, reviewing pending team queue).",
    "",
    "## Out of Scope Examples",
    'Anything NOT directly related to leave management or team attendance is "out_of_scope". Examples:',
    "- Room or equipment booking.",
    "- Payroll or salary queries.",
    "- IT support or technical issues.",
    "- General company information or policies unrelated to leave.",
    "- Casual chat or non-work related topics.",
    "",
    'If the request is clearly unrelated to the specialists above, return "out_of_scope".',
    'If the message is ambiguous but likely related to leave, default to "employee".',
  ];

  if (isOngoingConversation) {
    lines.push(
      "",
      "## Active leave conversation",
      "The user is already engaged in a leave management conversation.",
      "A short follow-up message — a date, a date range, a reason phrase, 'yes', 'ok', or any brief reply — is a continuation of that conversation.",
      "NEVER classify a follow-up message as out_of_scope when a leave conversation is in progress.",
      'Default to "employee" for any follow-up that is not clearly a manager team action.',
    );
  }

  if (session.managedEmployees.length > 0) {
    const names = session.managedEmployees.map((e) => e.name).join(", ");
    lines.push(
      "",
      "## Direct reports",
      names,
      'Route to "manager" if the message mentions any of these names in the context of leave approval or team oversight.',
    );
  }

  return lines.join("\n");
}

function buildRoutingPrompt(messages: UIMessage[], userText: string): string {
  // For ongoing conversations, include a brief summary of the last few exchanges
  // so the model can understand that a date / short reply is a follow-up.
  if (messages.length <= 1) return userText || "(no message)";

  const recentContext = messages
    .slice(-4)
    .map((m) => {
      const text = getTextParts(m).join(" ").slice(0, 120).trim();
      if (!text) return null;
      return `${m.role === "user" ? "User" : "Assistant"}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Recent conversation:\n${recentContext}\n\nLatest user message to route: ${userText || "(no message)"}`;
}

export async function routeConversation(
  input: RouteConversationInput,
): Promise<CoordinatorDecision> {
  const userText = getLatestUserText(input.messages);
  const isOngoingConversation = input.messages.length > 1;

  const { object } = await generateObject({
    model: input.model,
    schema: routeSchema,
    system: buildRoutingSystemPrompt(input.session, isOngoingConversation),
    prompt: buildRoutingPrompt(input.messages, userText),
  });

  if (object.specialist === "out_of_scope") {
    return {
      type: "deny",
      message: `Sorry, I can only help you with leave-related topics: checking your balance, viewing or submitting time-off requests, cancelling requests, and leave policy questions. For anything else, please contact the relevant department.`,
    };
  }

  if (object.specialist === "manager" && input.session.role !== "manager") {
    return {
      type: "deny",
      message:
        "Manager actions are only available in manager mode. Switch to Manager mode in the sidebar, then try again.",
    };
  }

  return { type: "delegate", specialist: object.specialist };
}
