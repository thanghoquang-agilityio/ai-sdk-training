import { generateObject } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import { DATE_AGENT_SYSTEM_PROMPT_V1 } from "@/agents/specialists/date/prompt/system-v1";
import { getTodayIsoDate } from "@/agents/handlers/common/date";

const dateResolutionSchema = z.object({
  resolvedDates: z.object({
    startDate: z.string().describe("ISO-8601 date (YYYY-MM-DD)"),
    endDate: z.string().describe("ISO-8601 date (YYYY-MM-DD)"),
    isAmbiguous: z.boolean().describe("True if the user needs to clarify"),
    clarificationMessage: z.string().optional().describe("Message to ask the user if ambiguous"),
    suggestions: z.array(z.string()).optional().describe("Friendly date suggestions (e.g. ['Next Monday', 'Tomorrow'])"),
  }),
});

/**
 * Invokes the Date Agent as a sub-agent to resolve relative or complex dates.
 */
export async function invokeDateAgent(
  query: string,
  session: MockAuthSession,
  model: LanguageModel,
) {
  const today = getTodayIsoDate(session.timeZone);

  const { object } = await generateObject({
    model,
    schema: dateResolutionSchema,
    system: `
${DATE_AGENT_SYSTEM_PROMPT_V1}

Today's date: ${today}
Timezone: ${session.timeZone}
`.trim(),
    prompt: `Resolve the following date query: "${query}"`,
  });

  return object.resolvedDates;
}
