import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test/msw/server";
import { API_URL } from "@/test/msw/handlers";
import { apiRequest, isAbortError } from "../../services/apiService";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const endpoint = (path: string) => `${API_URL}${path}`;

describe("apiRequest", () => {
  it("wraps a success envelope under { response }", async () => {
    server.use(
      http.post(endpoint("echo"), () =>
        HttpResponse.json({
          header: { code: 200, message: "ok" },
          response: { value: 42 },
        }),
      ),
    );

    const res = await apiRequest("post", "echo", { a: 1 });
    expect(res.response.response).toEqual({ value: 42 });
  });

  it("returns the body directly for the legacy top-level code 200 shape", async () => {
    server.use(
      http.post(endpoint("legacy"), () =>
        HttpResponse.json({ code: 200, data: "x" }),
      ),
    );

    const res = await apiRequest("post", "legacy", {});
    expect(res).toEqual({ code: 200, data: "x" });
  });

  it("toasts and throws on a non-401 error envelope", async () => {
    server.use(
      http.post(endpoint("bad"), () =>
        HttpResponse.json({ header: { code: 400, message: "Bad input" } }),
      ),
    );

    await expect(apiRequest("post", "bad", {})).rejects.toThrow("Bad input");
    expect(toast.error).toHaveBeenCalledWith("Bad input");
  });

  it("surfaces a network error message on a transport failure", async () => {
    server.use(http.post(endpoint("down"), () => HttpResponse.error()));

    await expect(apiRequest("post", "down", {})).rejects.toThrow(
      /network error/i,
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Network error. Please check your connection and try again.",
    );
  });

  it("attaches the bearer token from localStorage to requests", async () => {
    localStorage.setItem("token", "my-token");
    let authHeader: string | null = null;
    server.use(
      http.post(endpoint("secure"), ({ request }) => {
        authHeader = request.headers.get("authorization");
        return HttpResponse.json({ header: { code: 200 }, response: {} });
      }),
    );

    await apiRequest("post", "secure", {});
    expect(authHeader).toBe("Bearer my-token");
  });

  it("persists a token returned in the response authorization header", async () => {
    server.use(
      http.post(endpoint("issue"), () =>
        HttpResponse.json(
          { header: { code: 200 }, response: {} },
          { headers: { authorization: "fresh-token" } },
        ),
      ),
    );

    await apiRequest("post", "issue", {});
    expect(localStorage.getItem("token")).toBe("fresh-token");
  });

  it("does not toast when silent", async () => {
    server.use(
      http.post(endpoint("quiet"), () =>
        HttpResponse.json({ header: { code: 502, message: "Provider down" } }),
      ),
      http.post(endpoint("quiet-down"), () => HttpResponse.error()),
    );

    await expect(apiRequest("post", "quiet", {}, "json", { silent: true })).rejects.toThrow(
      "Provider down",
    );
    await expect(
      apiRequest("post", "quiet-down", {}, "json", { silent: true }),
    ).rejects.toThrow(/network error/i);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rejects a cancelled request with an AbortError and no toast", async () => {
    server.use(
      http.post(endpoint("slow"), async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ header: { code: 200 }, response: {} });
      }),
    );
    const controller = new AbortController();
    const request = apiRequest("post", "slow", {}, "json", { signal: controller.signal });
    controller.abort();

    const error = await request.catch((e) => e);
    expect(isAbortError(error)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  describe("blob responses", () => {
    it("returns the binary body and headers", async () => {
      server.use(
        http.post(endpoint("audio"), () =>
          new HttpResponse(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "audio/wav", "x-src": "p1" },
          }),
        ),
      );

      const res = await apiRequest("post", "audio", {}, "blob");
      expect(res.response).toBeInstanceOf(Blob);
      expect((res.response as Blob).size).toBe(3);
      expect(res.headers["x-src"]).toBe("p1");
    });

    it("treats a JSON envelope as an error", async () => {
      server.use(
        http.post(endpoint("audio-error"), () =>
          HttpResponse.json({ header: { code: 503, message: "Text to speech is busy" } }),
        ),
      );

      await expect(apiRequest("post", "audio-error", {}, "blob")).rejects.toThrow(
        "Text to speech is busy",
      );
      expect(toast.error).toHaveBeenCalledWith("Text to speech is busy");
    });

    it("falls back to a generic message for an unreadable JSON body", async () => {
      server.use(
        http.post(endpoint("audio-garbled"), () =>
          new HttpResponse("{not json", { headers: { "content-type": "application/json" } }),
        ),
      );

      await expect(
        apiRequest("post", "audio-garbled", {}, "blob", { silent: true }),
      ).rejects.toThrow(/something went wrong on our end/i);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("ends the session on a 401 envelope even when silent", async () => {
      localStorage.setItem("token", "stale");
      server.use(
        http.post(endpoint("audio-expired"), () =>
          HttpResponse.json({ header: { code: 401, message: "Session expired" } }),
        ),
      );

      await expect(
        apiRequest("post", "audio-expired", {}, "blob", { silent: true }),
      ).rejects.toThrow("Session expired");
      expect(toast.error).toHaveBeenCalledWith("Session expired");
      expect(localStorage.getItem("token")).toBeNull();
    });
  });

  describe("on a 401 envelope", () => {
    // Note: the handler sets `window.location.href = "/"`. In jsdom that is a
    // (logged) no-op rather than a real navigation, and replacing the location
    // object breaks axios's XHR path, so we assert on the *observable* session
    // teardown instead — storage cleared and the session-expired toast.
    it("clears storage and surfaces the session-expired toast", async () => {
      localStorage.setItem("token", "stale");
      sessionStorage.setItem("k", "v");
      server.use(
        http.post(endpoint("expired"), () =>
          HttpResponse.json({
            header: { code: 401, message: "error" },
            response: null,
          }),
        ),
      );

      await apiRequest("post", "expired", {});

      expect(toast.error).toHaveBeenCalledWith(
        "Your session has expired. Please log in again.",
      );
      expect(localStorage.getItem("token")).toBeNull();
      expect(sessionStorage.getItem("k")).toBeNull();
    });
  });

  describe("on a sign-in request (credentials)", () => {
    it("reports a 401 as rejected credentials and leaves the session alone", async () => {
      localStorage.setItem("keep", "me");
      server.use(
        http.post(endpoint("login-401"), () =>
          HttpResponse.json({ header: { code: 401, message: "Invalid credentials." } }),
        ),
      );

      await expect(
        apiRequest("post", "login-401", {}, "json", { credentials: true, silent: true }),
      ).rejects.toThrow("Invalid credentials.");
      expect(toast.error).not.toHaveBeenCalled();
      expect(localStorage.getItem("keep")).toBe("me");
    });

    it("falls back to a credentials message, not 'session expired'", async () => {
      server.use(
        http.post(endpoint("login-401-bare"), () =>
          HttpResponse.json({ header: { code: 401, message: "error" } }),
        ),
      );

      await expect(
        apiRequest("post", "login-401-bare", {}, "json", { credentials: true }),
      ).rejects.toThrow("Incorrect email or password.");
      // Not silent: the failure is toasted once.
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("Incorrect email or password.");
    });

    it("treats an HTTP 401 the same way", async () => {
      localStorage.setItem("keep", "me");
      server.use(
        http.post(endpoint("login-http-401"), () =>
          HttpResponse.json(
            { header: { code: 401, message: "Invalid credentials." } },
            { status: 401 },
          ),
        ),
      );

      await expect(
        apiRequest("post", "login-http-401", {}, "json", { credentials: true, silent: true }),
      ).rejects.toThrow("Invalid credentials.");
      expect(localStorage.getItem("keep")).toBe("me");
    });
  });
});
