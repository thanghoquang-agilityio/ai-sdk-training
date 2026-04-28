import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  API_COMMON_ERROR_COPY,
  OPENAI_VALIDATION_API_COPY,
} from "@/constants/api";
import type { OpenAIKeyValidationRequestBody } from "@/types/api";
import { getErrorMessage } from "@/utils/error";

function badRequest(message: string) {
  return Response.json({ ok: false, message }, { status: 400 });
}

export async function POST(req: Request) {
  let body: OpenAIKeyValidationRequestBody;
  try {
    body = (await req.json()) as OpenAIKeyValidationRequestBody;
  } catch {
    return badRequest(API_COMMON_ERROR_COPY.invalidJsonBody);
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return badRequest(OPENAI_VALIDATION_API_COPY.missingApiKey);
  }

  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: OPENAI_VALIDATION_API_COPY.baseUrl,
    });

    await generateText({
      model: openai.chat(process.env.OPENAI_MODEL ?? OPENAI_VALIDATION_API_COPY.testModel),
      prompt: OPENAI_VALIDATION_API_COPY.testPrompt,
    });

    return Response.json({
      ok: true,
      message: OPENAI_VALIDATION_API_COPY.valid,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: OPENAI_VALIDATION_API_COPY.invalid,
        details: getErrorMessage(error),
      },
      { status: 400 },
    );
  }
}
