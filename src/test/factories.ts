import type { Project } from "@/api/Projects/query";
import type { ChatSession } from "@/lib/chatStore";

/**
 * Deterministic test-data factories.
 *
 * Each returns a complete, valid object with sensible defaults that any test can
 * partially override. Using factories (instead of inline literals) keeps tests
 * free of magic values and resilient to type changes in the shapes they build.
 */

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    project_id: "p1",
    project_name: "Test Project",
    project_type: "brand_representative",
    description: "A project used in tests",
    status: "active",
    total_personas_count: 3,
    personas_ready: 2,
    total_files_count: 5,
    files_processed: 5,
    ...overrides,
  };
}

export function makeChatSession(
  overrides: Partial<ChatSession> = {},
): ChatSession {
  const now = 1_700_000_000_000;
  return {
    id: "c1",
    kind: "builder",
    projectId: "p1",
    title: "Test chat",
    ended: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * The base64(JSON) "user" blob the app stores in localStorage after login.
 * Auth-aware code reads `payload.token` from it (see lib/api.ts, api/Projects).
 */
export function makeStoredUser(
  overrides: Partial<{ token: string; firstName: string; lastName: string }> = {},
): string {
  const user = { token: "test-token", firstName: "Test", lastName: "User", ...overrides };
  return btoa(JSON.stringify(user));
}

/** Persist a logged-in user into localStorage for tests that need auth. */
export function authenticate(token = "test-token") {
  localStorage.setItem("user", makeStoredUser({ token }));
  localStorage.setItem("token", token);
}
