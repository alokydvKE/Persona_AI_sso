import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";
import { apiRequest } from "@/services/apiService";
import { getAuthToken, postApi } from "../../lib/api";
import { makeStoredUser } from "@/test/factories";

vi.mock("@/services/apiService", () => ({ apiRequest: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockApiRequest = vi.mocked(apiRequest);

/** Wrap an inner payload in the {response: envelope} shape apiRequest returns. */
function envelope(code: number, response: unknown, message = "ok") {
  return { response: { header: { code, message }, response } };
}

describe("getAuthToken", () => {
  it("returns an empty string when no user is stored", () => {
    expect(getAuthToken()).toBe("");
  });

  it("decodes the base64 user blob and returns its token", () => {
    localStorage.setItem("user", makeStoredUser({ token: "abc123" }));
    expect(getAuthToken()).toBe("abc123");
  });

  it("returns an empty string for an undecodable / malformed blob", () => {
    localStorage.setItem("user", "!!!not-base64-json!!!");
    expect(getAuthToken()).toBe("");
  });

  it("returns an empty string when the decoded user has no token", () => {
    localStorage.setItem("user", btoa(JSON.stringify({ firstName: "A" })));
    expect(getAuthToken()).toBe("");
  });
});

describe("postApi", () => {
  beforeEach(() => mockApiRequest.mockReset());

  it("returns the inner response payload on a 200 envelope", async () => {
    mockApiRequest.mockResolvedValue(envelope(200, { id: 7 }));
    await expect(postApi("projects/get", {})).resolves.toEqual({ id: 7 });
  });

  it("returns the payload when no envelope code is present", async () => {
    mockApiRequest.mockResolvedValue({
      response: { header: {}, response: { ok: true } },
    });
    await expect(postApi("x", {})).resolves.toEqual({ ok: true });
  });

  it("throws a network error when the response shape is empty", async () => {
    mockApiRequest.mockResolvedValue(undefined);
    await expect(postApi("x", {})).rejects.toThrow(/network error/i);
  });

  it("toasts and throws on a non-401 error envelope", async () => {
    // "error" is an opaque backend message, so the code-based default is used.
    mockApiRequest.mockResolvedValue(envelope(404, null, "error"));
    await expect(postApi("x", {})).rejects.toThrow(/couldn't find/i);
    expect(toast.error).toHaveBeenCalledWith(
      "We couldn't find what you were looking for.",
    );
  });

  describe("on a 401 envelope", () => {
    const originalLocation = window.location;
    beforeEach(() => {
      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
      });
    });
    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it("clears storage, redirects home, and throws", async () => {
      localStorage.setItem("user", makeStoredUser());
      sessionStorage.setItem("k", "v");
      mockApiRequest.mockResolvedValue(envelope(401, null, "error"));

      await expect(postApi("x", {})).rejects.toThrow(/session has expired/i);

      expect(toast.error).toHaveBeenCalledWith(
        "Your session has expired. Please log in again.",
      );
      expect(localStorage.getItem("user")).toBeNull();
      expect(sessionStorage.getItem("k")).toBeNull();
      expect(window.location.href).toBe("/");
    });
  });
});
