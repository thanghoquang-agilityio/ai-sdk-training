import { ERROR_COPY } from "@/constants/error";
import type { ApiErrorPayload } from "@/types/error";

const DEFAULT_ERROR_MESSAGE = ERROR_COPY.unknown;

export function getErrorMessage(
  error: unknown,
  fallbackMessage = DEFAULT_ERROR_MESSAGE,
): string {
  switch (true) {
    case error instanceof Error:
      return error.message;
    case typeof error === "string":
      return error;
    case Boolean(error && typeof error === "object" && "message" in error): {
      const message = (error as { message?: string }).message;
      return typeof message === "string" ? message : fallbackMessage;
    }
    default:
      return fallbackMessage;
  }
}

function getNestedErrorMessage(
  value: string | { message?: string } | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  return typeof value?.message === "string" ? value.message : undefined;
}

export function normalizeErrorMessage(
  rawMessage: string,
  fallbackMessage = DEFAULT_ERROR_MESSAGE,
): string {
  const trimmedMessage = rawMessage.trim();
  if (!trimmedMessage) return fallbackMessage;

  try {
    const parsed = JSON.parse(trimmedMessage) as ApiErrorPayload;

    const fromError = getNestedErrorMessage(parsed.error);
    const fromMessage = getNestedErrorMessage(parsed.message);
    const fromDetails = getNestedErrorMessage(parsed.details);

    switch (true) {
      case typeof fromError === "string":
        return fromError;
      case typeof fromMessage === "string":
        return fromMessage;
      case typeof fromDetails === "string":
        return fromDetails;
      default:
        return trimmedMessage;
    }
  } catch {
    return trimmedMessage;
  }
}

export function getDisplayErrorMessage(
  error: unknown,
  fallbackMessage = DEFAULT_ERROR_MESSAGE,
): string {
  return normalizeErrorMessage(getErrorMessage(error, fallbackMessage));
}
