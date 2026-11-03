import { describe, it, expect, vi, afterEach } from "vitest";
import { aesEncrypt, aesDecrypt } from "../../lib/encryption&decryption";

// The encryption key is injected via vitest.config.ts `test.env` so the module
// (which throws at import time on a missing key) loads cleanly.

describe("aes encryption", () => {
  it("round-trips plaintext through encrypt -> decrypt", () => {
    const plain = "hello@example.com";
    expect(aesDecrypt(aesEncrypt(plain))).toBe(plain);
  });

  it("is deterministic for ECB mode (same input -> same ciphertext)", () => {
    expect(aesEncrypt("secret")).toBe(aesEncrypt("secret"));
  });

  it("produces a base64 ciphertext distinct from the plaintext", () => {
    const cipher = aesEncrypt("password123");
    expect(cipher).not.toBe("password123");
    expect(cipher).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("round-trips unicode and longer payloads", () => {
    const plain = "Café — déjà vu 🚀 with a longer sentence to span blocks";
    expect(aesDecrypt(aesEncrypt(plain))).toBe(plain);
  });

  it("round-trips an empty string", () => {
    expect(aesDecrypt(aesEncrypt(""))).toBe("");
  });
});

describe("module load guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws on import when VITE_REACT_APP_ENCRYPTION_KEY is missing", async () => {
    vi.stubEnv("VITE_REACT_APP_ENCRYPTION_KEY", "");
    vi.resetModules();
    await expect(import("../../lib/encryption&decryption")).rejects.toThrow(
      /ENCRYPTION_KEY is not defined/,
    );
  });
});
