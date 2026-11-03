import { apiRequest, type ApiRequestOptions } from "@/services/apiService";
import { toast } from "sonner";
import { getApiErrorMessage, getNetworkErrorMessage } from "@/lib/apiError";

/**
 * Reads the auth token that the backend expects inside request payloads.
 *
 * The app stores the logged-in user as base64(JSON) under localStorage "user"
 * (see Auth/mutation.tsx). Every backend route authenticates via `payload.token`,
 * so this is the single source of truth for that value.
 */
export function getAuthToken(): string {
  const userStr = localStorage.getItem("user");
  if (!userStr) return "";
  try {
    const userData = JSON.parse(atob(userStr));
    return userData?.token || "";
  } catch {
    return "";
  }
}

export type ApiEnvelope<T> = {
  header: { code: number; message: string };
  response: T;
};

/**
 * POST a payload to the API and return the inner `response` payload.
 *
 * The backend always answers with HTTP 200 and an envelope
 * `{ header: { code, message }, response }`, so non-success states (404/400/401)
 * are encoded in `header.code` rather than the HTTP status. `apiRequest` wraps
 * the axios body as `{ response: <envelope> }` on success, or resolves to
 * `undefined` when its interceptor swallowed a transport error.
 *
 * This helper normalises both cases: it throws on any non-200 envelope code (so
 * react-query surfaces an error state) and surfaces a toast for the user. On a
 * 401 it clears the session and redirects to the login screen.
 */
export async function postApi<T>(
  url: string,
  body: Record<string, unknown>,
  options?: ApiRequestOptions,
): Promise<T> {
  // `apiRequest` already surfaces a toast and throws for non-success envelopes
  // and transport errors; the checks below are a defensive fallback in case a
  // caller reaches here with an unexpected shape.
  const res = await apiRequest("post", url, body, "json", options);

  if (!res || !res.response) {
    throw new Error(getNetworkErrorMessage());
  }

  const envelope = res.response as ApiEnvelope<T>;
  const code = envelope?.header?.code;
  const message = envelope?.header?.message;

  if (code && code !== 200) {
    if (code === 401) {
      toast.error(getApiErrorMessage(401, message));
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    } else if (!options?.silent) {
      toast.error(getApiErrorMessage(code, message));
    }
    throw new Error(getApiErrorMessage(code, message));
  }

  return envelope.response;
}
