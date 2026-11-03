import { describe, it, expect } from "vitest";
import { validateCredentials } from "@/lib/validateCredentials";

describe("validateCredentials", () => {
  it("passes a well-formed email and any password", () => {
    expect(validateCredentials({ email: "ada@example.com", password: "x" })).toEqual({});
  });

  it("asks for both fields when empty", () => {
    expect(validateCredentials({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  it("treats a whitespace-only email as empty", () => {
    expect(validateCredentials({ email: "   ", password: "x" }).email).toBe(
      "Enter your email address.",
    );
  });

  it.each(["ada", "ada@", "@example.com", "ada@example", "a da@example.com"])(
    "rejects the malformed email %j",
    (email) => {
      expect(validateCredentials({ email, password: "x" }).email).toBe(
        "Enter a valid email address.",
      );
    },
  );

  it("judges the email trimmed", () => {
    expect(validateCredentials({ email: "  ada@example.com  ", password: "x" })).toEqual({});
  });

  it("takes the password exactly as typed", () => {
    expect(validateCredentials({ email: "ada@example.com", password: " " })).toEqual({});
  });
});
