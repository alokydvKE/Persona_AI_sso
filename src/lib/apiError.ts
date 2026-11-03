/**
 * Centralised, user-facing copy for API error responses.
 *
 * The backend answers with an envelope `{ header: { code, message }, response }`
 * (HTTP is always 200), so error states are encoded in `header.code`. This helper
 * is the single source of truth for turning a status code + optional backend
 * message into something we can drop into a toast.
 *
 * The backend message is preferred when present and meaningful; otherwise we fall
 * back to a friendly default mapped from the status code.
 */

/** Default copy per HTTP/envelope status code. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check the details and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to perform this action.",
  404: "We couldn't find what you were looking for.",
  409: "This action conflicts with the current state. Please refresh and try again.",
  422: "Some of the information provided is invalid. Please review and try again.",
  500: "Something went wrong on our end. Please try again shortly.",
};

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** A rejected sign-in, when the backend doesn't say more. */
export const INVALID_CREDENTIALS_MESSAGE = "Incorrect email or password.";
const NETWORK_MESSAGE =
  "Network error. Please check your connection and try again.";

/** A backend message we should ignore in favour of friendlier copy. */
function isUsableBackendMessage(message?: string | null): message is string {
  if (!message) return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  // Internal/opaque messages we don't want to surface verbatim.
  return !/^(error|success|failed|internal server error)$/i.test(trimmed);
}

/**
 * Resolve the message to show the user for a given status code.
 * Prefers a meaningful backend message, then `fallback` when the caller knows
 * better than the status code (e.g. a 401 on sign-in means wrong credentials,
 * not an expired session), then a code-specific default, then a generic one.
 */
export function getApiErrorMessage(
  code?: number,
  backendMessage?: string | null,
  fallback?: string,
): string {
  if (isUsableBackendMessage(backendMessage)) return backendMessage;
  if (fallback) return fallback;
  if (code && STATUS_MESSAGES[code]) return STATUS_MESSAGES[code];
  if (code && code >= 500) return STATUS_MESSAGES[500];
  if (code && code >= 400) return STATUS_MESSAGES[400];
  return GENERIC_MESSAGE;
}

/** Message for transport-level failures (no response/envelope at all). */
export function getNetworkErrorMessage(): string {
  return NETWORK_MESSAGE;
}
