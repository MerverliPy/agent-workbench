const API_KEY_PATTERN =
  /(?:sk|api|key|token|secret|password|auth)[-_]?[a-zA-Z0-9]{8,}/gi;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const AUTH_HEADER_KEY = /authorization/i;

const REDACTED = "***";

export function redactApiKey(key: string): string {
  if (key.length <= 8) return REDACTED;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function redactAuthorizationHeader(header: string): string {
  if (!header) return header;
  return header.replace(BEARER_PATTERN, "Bearer ***");
}

export function redactString(value: string): string {
  let result = value;
  result = result.replace(BEARER_PATTERN, "Bearer ***");
  result = result.replace(API_KEY_PATTERN, REDACTED);
  return result;
}

export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (AUTH_HEADER_KEY.test(key)) {
      redacted[key] = redactAuthorizationHeader(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function redactError(error: Error, apiKey?: string): Error {
  let message = redactString(error.message);
  if (apiKey && apiKey.length > 0) {
    message = message.replaceAll(apiKey, redactApiKey(apiKey));
  }
  const redacted = new Error(message);
  redacted.name = error.name;
  if (error.stack) {
    redacted.stack = redactString(error.stack);
    if (apiKey && redacted.stack) {
      redacted.stack = redacted.stack.replaceAll(apiKey, redactApiKey(apiKey));
    }
  }
  if (error.cause) {
    redacted.cause =
      error.cause instanceof Error
        ? redactError(error.cause, apiKey)
        : error.cause;
  }
  return redacted;
}
