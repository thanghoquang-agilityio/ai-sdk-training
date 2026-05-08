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

function buildRoutingSystemPrompt(session: MockAuthSession): string {
  const lines = [
    "You are a routing coordinator for a Leave Management system.",
    "Your job is to classify which specialist agent should handle the user's message, or identify if it is out of scope.",
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

export async function routeConversation(
  input: RouteConversationInput,
): Promise<CoordinatorDecision> {
  const userText = getLatestUserText(input.messages);

  const { object } = await generateObject({
    model: input.model,
    schema: routeSchema,
    system: buildRoutingSystemPrompt(input.session),
    prompt: userText || "(no message)",
  });

  if (object.specialist === "out_of_scope") {
    return {
      type: "deny",
      message: `I'm sorry, I can only help with leave requests and team management. I don't have the capability to handle your request. Please contact the relevant department for assistance.`,
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
