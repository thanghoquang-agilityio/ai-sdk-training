import { generateObject } from "ai";
import type { LanguageModel, UIMessage } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import type { CoordinatorDecision } from "./types";
import { getLatestUserText, getTextParts } from "@/utils/message";

const routeSchema = z.object({
  specialist: z.enum(["employee", "manager", "out_of_scope"]),
});

type RouteConversationInput = {
  model: LanguageModel;
  messages: UIMessage[];
  session: MockAuthSession;
};

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
    "- employee: Personal leave queries AND leave policy questions (e.g., checking own leave balance, listing own requests, submitting or cancelling own leave, asking about leave entitlements, carryover rules, notice periods, sick leave certificates, half-days, probation restrictions).",
    "- manager: Team management (e.g., approving/rejecting requests for direct reports, listing team members, reviewing pending team queue).",
    "",
    "## Always in scope",
    "Any question about leave policy, leave rules, or leave entitlements is ALWAYS in scope — route to employee.",
    "",
    "## Greetings",
    'A greeting or conversational opener (e.g., "hello", "hi", "hey", "good morning", "how are you") is ALWAYS routed to "employee". Never classify a greeting as out_of_scope.',
    "",
    "## Out of Scope Examples",
    'Anything NOT directly related to leave management or team attendance is "out_of_scope". Examples:',
    "- Room or equipment booking.",
    "- Payroll or salary queries.",
    "- IT support or technical issues.",
    "- General company information or non-leave company policies.",
    "- Casual conversation with no leave intent (e.g., 'tell me a joke', 'what is the weather?').",
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

// Matches pure greeting messages so they bypass the LLM router entirely.
const GREETING_RE = /^(hi+|hello+|hey+|howdy|good\s+(morning|afternoon|evening)|how\s+are\s+you|what'?s\s+up|greetings)[^a-z]*$/i;

// Matches leave-policy intent so the LLM never misclassifies it as out_of_scope.
const POLICY_RE = /\b(leave\s+policy|policy\s+question|leave\s+rule|leave\s+entitl|carryover|carry[\s-]over|notice\s+period|sick\s+leave|annual\s+leave|time[\s-]off\s+(policy|rule)|half[\s-]day|probation|leave\s+balance|my\s+balance|check.*balance)\b/i;

export async function routeConversation(
  input: RouteConversationInput,
): Promise<CoordinatorDecision> {
  const userText = getLatestUserText(input.messages);
  const isOngoingConversation = input.messages.length > 1;

  // Short-circuit for greetings — no LLM call needed, delegate based on session role.
  if (!isOngoingConversation && GREETING_RE.test(userText)) {
    return {
      type: "delegate",
      specialist: input.session.role === "manager" ? "manager" : "employee",
    };
  }

  // Short-circuit for clear leave/policy intent — never let the LLM misroute these.
  if (POLICY_RE.test(userText)) {
    return { type: "delegate", specialist: "employee" };
  }

  const { object } = await generateObject({
    model: input.model,
    schema: routeSchema,
    system: buildRoutingSystemPrompt(input.session, isOngoingConversation),
    prompt: buildRoutingPrompt(input.messages, userText),
  });

  if (object.specialist === "out_of_scope") {
    return {
      type: "deny",
      message: "Sorry, I can only help you with leave-related topics: checking your balance, viewing or submitting time-off requests, cancelling requests, and answering leave policy questions.",
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
