import {
  API_COMMON_ERROR_COPY,
  OLLAMA_VALIDATION_API_COPY,
} from "@/constants/api";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import type { OllamaUrlValidationRequestBody } from "@/types/api";
import { getErrorMessage } from "@/utils/error";
import { badRequest } from "@/utils/http";

export async function POST(req: Request) {
  let body: OllamaUrlValidationRequestBody;

  try {
    body = (await req.json()) as OllamaUrlValidationRequestBody;
  } catch {
    return badRequest({ ok: false, message: API_COMMON_ERROR_COPY.invalidJsonBody });
  }

  const baseUrl = normalizeOllamaBaseUrl(body.baseUrl);
  if (!baseUrl) {
    return badRequest({ ok: false, message: OLLAMA_VALIDATION_API_COPY.invalidBaseUrl });
  }

  try {
    const tagsUrl = new URL(OLLAMA_VALIDATION_API_COPY.tagsPath, baseUrl).toString();
    const response = await fetch(tagsUrl, {
      signal: AbortSignal.timeout(OLLAMA_VALIDATION_API_COPY.requestTimeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      return badRequest({
        ok: false,
        message: `${OLLAMA_VALIDATION_API_COPY.tagsEndpointErrorPrefix} ${response.status}. ${OLLAMA_VALIDATION_API_COPY.tagsEndpointErrorSuffix}`,
      });
    }

    const data = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };

    const modelCount = Array.isArray(data.models) ? data.models.length : 0;

    return Response.json({
      ok: true,
      message: OLLAMA_VALIDATION_API_COPY.verified,
      normalizedBaseUrl: baseUrl,
      details:
        modelCount > 0
          ? `${OLLAMA_VALIDATION_API_COPY.detectedModelsPrefix} ${modelCount} model(s).`
          : OLLAMA_VALIDATION_API_COPY.noModelsDetected,
    });
  } catch (error) {
    return badRequest({
      ok: false,
      message: `${OLLAMA_VALIDATION_API_COPY.connectionErrorPrefix} ${getErrorMessage(error)}`,
    });
  }
}
