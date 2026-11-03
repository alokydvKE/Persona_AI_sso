/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// Vitest runs in a separate config from `vite.config.ts` so the Tailwind plugin
// (which is irrelevant to behavioural tests and slows startup) is left out, and
// the test-only env vars below are injected before any module loads. Several
// modules read `import.meta.env.*` at import time — notably
// `lib/encryption&decryption.ts`, which THROWS on load if the encryption key is
// missing — so these must be present for the whole suite to import at all.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    clearMocks: true,
    env: {
      // 32-char key => AES-256; value is irrelevant, only its presence/length.
      VITE_REACT_APP_ENCRYPTION_KEY: "test_encryption_key_0123456789ab",
      VITE_REACT_APP_API_URL: "http://localhost/api/",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/components/ui/**", // generated shadcn primitives
        "src/assets/**",
        "src/data/**", // static fixtures / dummy data
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
