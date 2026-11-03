import { describe, it, expect } from "vitest";
import { getApiErrorMessage, getNetworkErrorMessage } from "../../lib/apiError";

describe("getApiErrorMessage", () => {
  it("prefers a meaningful backend message over defaults", () => {
    expect(getApiErrorMessage(400, "Email already registered")).toBe(
      "Email already registered",
    );
  });

  it.each(["error", "success", "failed", "internal server error", "  ", ""])(
    "ignores the opaque backend message %j and uses code-based copy",
    (msg) => {
      expect(getApiErrorMessage(404, msg)).toBe(
        "We couldn't find what you were looking for.",
      );
    },
  );

  it("ignores opaque messages case-insensitively", () => {
    expect(getApiErrorMessage(500, "INTERNAL SERVER ERROR")).toBe(
      "Something went wrong on our end. Please try again shortly.",
    );
  });

  it.each([
    [400, "Invalid request. Please check the details and try again."],
    [401, "Your session has expired. Please log in again."],
    [403, "You don't have permission to perform this action."],
    [404, "We couldn't find what you were looking for."],
    [409, "This action conflicts with the current state. Please refresh and try again."],
    [422, "Some of the information provided is invalid. Please review and try again."],
    [500, "Something went wrong on our end. Please try again shortly."],
  ])("maps known status code %i to its default copy", (code, expected) => {
    expect(getApiErrorMessage(code)).toBe(expected);
  });

  it("maps unknown 5xx codes to the generic server error", () => {
    expect(getApiErrorMessage(503)).toBe(
      "Something went wrong on our end. Please try again shortly.",
    );
  });

  it("maps unknown 4xx codes to the generic client error", () => {
    expect(getApiErrorMessage(418)).toBe(
      "Invalid request. Please check the details and try again.",
    );
  });

  it("falls back to the generic message when no code is given", () => {
    expect(getApiErrorMessage()).toBe("Something went wrong. Please try again.");
    expect(getApiErrorMessage(undefined, null)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("getNetworkErrorMessage", () => {
  it("returns the transport-failure copy", () => {
    expect(getNetworkErrorMessage()).toBe(
      "Network error. Please check your connection and try again.",
    );
  });
});
