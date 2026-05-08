import { generateObject } from "ai";
import type { LanguageModel, UIMessage } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import type { CoordinatorDecision } from "../types";
import { getTextParts } from "@/utils/message";

const routeSchema = z.object({
  specialist: z.enum(["employee", "manager", "date"]),
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
    "You are a routing coordinator. Classify which specialist agent should handle the user's message.",
    "",
    "## Route hints",
    "- employee: personal time-off — own leave balance, own request history, submit own request, cancel own request",
    "- manager: team operations — approve or reject team requests, list team members, review team pending queue",
    "",
    'Default to "employee" for ambiguous or unclear messages.',
  ];

  if (session.managedEmployees.length > 0) {
    const names = session.managedEmployees.map((e) => e.name).join(", ");
    lines.push(
      "",
      "## Direct reports",
      names,
      'Route to "manager" if the message mentions any of these names.',
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

  if (object.specialist === "manager" && input.session.role !== "manager") {
    return {
      type: "deny",
      message:
        "Manager actions are only available in manager mode. Switch to Manager mode in the sidebar, then try again.",
    };
  }

  return { type: "delegate", specialist: object.specialist };
}
