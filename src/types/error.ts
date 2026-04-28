type ErrorPayloadValue = string | { message?: string };

export type ApiErrorPayload = {
  error?: ErrorPayloadValue;
  message?: ErrorPayloadValue;
  details?: ErrorPayloadValue;
};
