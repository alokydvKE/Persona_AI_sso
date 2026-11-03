import { getApiErrorMessage } from "@/lib/apiError";
import { handleSessionExpiration } from "@/services/apiService";

/**
 * Helpers for the few endpoints read with `fetch` instead of axios.
 *
 * axios is built on XHR, which only exposes a response body once it is
 * complete, so anything that must be consumed AS IT ARRIVES (NDJSON group-chat
 * replies, streamed speech audio) goes through `fetch` + `res.body.getReader()`.
 * These helpers keep those calls behaving like every axios call: same base URL,
 * same bearer header, same sliding token refresh, same envelope errors.
 */

// The configured base may or may not carry a trailing slash; axios normalises
// that for every other call, so it's done by hand here.
const BASE_URL = String(import.meta.env.VITE_REACT_APP_API_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${BASE_URL}/${path.replace(/^\/+/, "")}`;
}

/** JSON request headers plus the bearer token, as the axios interceptor sends. */
export function jsonAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const bearer = localStorage.getItem("token");
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  return headers;
}

/** Keep the sliding session the axios response interceptor maintains. */
export function storeRefreshedToken(res: Response): void {
  const refreshed = res.headers.get("authorization");
  if (refreshed) localStorage.setItem("token", refreshed);
}

/**
 * Turn a response that is NOT the expected stream into a user-facing failure.
 *
 * The backend reports errors as its usual JSON envelope (HTTP 200,
 * `header.code`), so the envelope is read when there is one; otherwise the
 * HTTP status stands in. A 401 ends the session exactly like the axios layer.
 */
export async function envelopeFailure(res: Response): Promise<{ code: number; message: string }> {
  const envelope: { header?: { code?: number; message?: string } } | null = await res
    .json()
    .catch(() => null);
  const code = envelope?.header?.code ?? (res.ok ? 500 : res.status);
  if (code === 401) handleSessionExpiration();
  return {
    code,
    message: getApiErrorMessage(code >= 400 ? code : 500, envelope?.header?.message),
  };
}
