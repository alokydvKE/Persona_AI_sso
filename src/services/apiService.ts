import axios from "axios";
import { toast } from "sonner";
import {
  getApiErrorMessage,
  getNetworkErrorMessage,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/apiError";

const platform_url = import.meta.env.VITE_REACT_APP_API_URL;

type ApiMethod = "get" | "post" | "put" | "delete";

export type ApiRequestOptions = {
  /** Cancels the request; a cancelled request rejects with an AbortError and no toast. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Don't toast failures — the caller reports them (e.g. to collapse repeats).
   * A 401 still toasts and ends the session, unless `credentials` is set.
   */
  silent?: boolean;
  /**
   * The request signs in, so there is no session to expire: a 401 means the
   * credentials were rejected. It is reported like any other failure (thrown,
   * toasted unless `silent`) instead of clearing storage and reloading the app.
   */
  credentials?: boolean;
};

const apiClient = axios.create({
  baseURL: platform_url,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token && (config.url !== "/uam/login")) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
    (response) => {
        // You can access headers here
        const token = response.headers['authorization'];
        if(token){
          localStorage.setItem('token', token)
        }
        // Store headers in a global state or context if needed
        return response;
    },
    (error) => Promise.reject(error.response || error.message)
);

export const handleSessionExpiration = (): void => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = "/"; // Redirect to login page
};

function abortError(): Error {
  const error = new Error("Request was cancelled");
  error.name = "AbortError";
  return error;
}

/** True for the error a cancelled request rejects with (see ApiRequestOptions.signal). */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export const apiRequest = async (
  method: ApiMethod,
  url: string,
  // headers?: Record<string, string>,
  data: any = null,
  responseType: "json" | "blob" = "json",
  options: ApiRequestOptions = {},
) => {
  const notify = (message: string) => {
    if (!options.silent) toast.error(message);
  };
  // A rejected sign-in (see ApiRequestOptions.credentials).
  const rejectCredentials = (backendMessage?: string, cause?: unknown): never => {
    const text = getApiErrorMessage(401, backendMessage, INVALID_CREDENTIALS_MESSAGE);
    notify(text);
    throw new Error(text, cause === undefined ? undefined : { cause });
  };

  try {
    // const requestHeaders = { ...headers };
    const response = await apiClient.request({
      method,
      url,
      data,
      // headers: requestHeaders,
      responseType,
      signal: options.signal,
      timeout: options.timeoutMs,
    });
    if (responseType === "json") {
      const body = response?.data;
      // The backend always answers HTTP 200; the real status lives in the
      // envelope (`header.code`, or a legacy top-level `code`).
      const code: number | undefined = body?.header?.code ?? body?.code;
      const message: string | undefined = body?.header?.message ?? body?.message;

      if (code === 401) {
        if (options.credentials) rejectCredentials(message);
        toast.error(getApiErrorMessage(401, message));
        handleSessionExpiration();
        return body;
      }

      // Any other non-success envelope is surfaced as a thrown error so
      // react-query (and mutations) move into an error state, with a toast.
      if (typeof code === "number" && code >= 400) {
        const friendly = getApiErrorMessage(code, message);
        notify(friendly);
        throw new Error(friendly);
      }

      // Success — preserve the historical return shapes used by callers.
      if (body?.code === 200) {
        return body;
      }
      return { response: body };
    } else {
      // Binary endpoints report failures as the usual JSON envelope instead of a
      // file, so a JSON body here is always an error.
      const contentType = String(response.headers?.["content-type"] ?? "").toLowerCase();
      if (contentType.includes("json")) {
        let body: {
          header?: { code?: number; message?: string };
          code?: number;
          message?: string;
        } | null = null;
        try {
          body = JSON.parse(await readBlobText(response.data as Blob));
        } catch {
          body = null;
        }
        const code: number = body?.header?.code ?? body?.code ?? 500;
        const message: string | undefined = body?.header?.message ?? body?.message;
        if (code === 401) {
          const message401 = getApiErrorMessage(401, message);
          toast.error(message401);
          handleSessionExpiration();
          throw new Error(message401);
        }
        const friendly = getApiErrorMessage(code >= 400 ? code : 500, message);
        notify(friendly);
        throw new Error(friendly);
      }
      return { response: response.data, headers: response.headers };
    }
  } catch (error: any) {
    if (options.signal?.aborted) {
      throw abortError();
    }

    // Errors we raised above are already toasted; the axios interceptor rejects
    // with a response object or a string (never an Error), so any Error here is
    // one of ours — just propagate it without a second toast.
    if (error instanceof Error) {
      throw error;
    }

    const status: number | undefined =
      error?.status ?? error?.response?.status ?? error?.data?.code;
    const backendMessage: string | undefined =
      error?.data?.header?.message ?? error?.response?.data?.header?.message;

    if (status === 401) {
      if (options.credentials) rejectCredentials(backendMessage, error);
      const message401 = getApiErrorMessage(401, backendMessage);
      toast.error(message401);
      handleSessionExpiration();
      throw new Error(message401, { cause: error });
    }

    const friendly = status
      ? getApiErrorMessage(status, backendMessage)
      : getNetworkErrorMessage();
    notify(friendly);
    throw new Error(friendly, { cause: error });
  }
};
