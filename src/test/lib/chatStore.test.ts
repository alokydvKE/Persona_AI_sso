import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSession,
  listSessions,
  upsertSession,
  touchSession,
  findActiveBuilderSession,
  removeSession,
  type ChatSession,
} from "../../lib/chatStore";

// localStorage is cleared globally in afterEach (see src/test/setup.ts).

// `upsertSession` stamps `updatedAt = Date.now()` on every write, so two writes
// in the same millisecond would tie and make ordering assertions flaky. A
// strictly-increasing clock makes every recency-based test deterministic.
// (restoreMocks: true in vitest.config.ts restores Date.now after each test.)
beforeEach(() => {
  let clock = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

function seed(overrides: Partial<ChatSession> = {}): ChatSession {
  return upsertSession({
    id: "c1",
    kind: "builder",
    projectId: "p1",
    title: "First chat",
    ...overrides,
  });
}

describe("chatStore", () => {
  describe("getSession", () => {
    it("returns undefined for a missing or empty id", () => {
      expect(getSession(undefined)).toBeUndefined();
      expect(getSession(null)).toBeUndefined();
      expect(getSession("nope")).toBeUndefined();
    });

    it("returns undefined (not a throw) when stored JSON is corrupt", () => {
      localStorage.setItem("personaai:chat:bad", "{not json");
      expect(getSession("bad")).toBeUndefined();
    });

    it("reads back a stored session", () => {
      seed();
      expect(getSession("c1")).toMatchObject({ id: "c1", title: "First chat" });
    });
  });

  describe("upsertSession", () => {
    it("creates a session with createdAt/updatedAt timestamps", () => {
      const s = seed();
      expect(s.createdAt).toBeTypeOf("number");
      expect(s.updatedAt).toBeTypeOf("number");
    });

    it("adds the id to the project index exactly once", () => {
      seed();
      seed({ title: "Renamed" });
      expect(listSessions("p1")).toHaveLength(1);
      expect(getSession("c1")?.title).toBe("Renamed");
    });

    it("preserves the original createdAt on update", () => {
      const created = upsertSession({
        id: "c1",
        kind: "builder",
        projectId: "p1",
        title: "x",
        createdAt: 1000,
      });
      const updated = upsertSession({ ...created, title: "y" });
      expect(updated.createdAt).toBe(1000);
    });
  });

  describe("listSessions", () => {
    it("returns an empty array for missing project id", () => {
      expect(listSessions(undefined)).toEqual([]);
      expect(listSessions("unknown")).toEqual([]);
    });

    it("sorts sessions most-recently-updated first", () => {
      upsertSession({ id: "a", kind: "builder", projectId: "p1", title: "A", updatedAt: 1 });
      upsertSession({ id: "b", kind: "builder", projectId: "p1", title: "B", updatedAt: 2 });
      const ids = listSessions("p1").map((s) => s.id);
      expect(ids).toEqual(["b", "a"]);
    });

    it("skips index entries whose session payload is gone", () => {
      seed();
      localStorage.removeItem("personaai:chat:c1"); // orphan the index entry
      expect(listSessions("p1")).toEqual([]);
    });
  });

  describe("touchSession", () => {
    it("does nothing for an unknown id", () => {
      touchSession("ghost");
      expect(getSession("ghost")).toBeUndefined();
    });

    it("patches title/ended and bumps updatedAt", () => {
      const s = seed({ updatedAt: 1 });
      touchSession("c1", { ended: true, title: "Done" });
      const after = getSession("c1")!;
      expect(after.ended).toBe(true);
      expect(after.title).toBe("Done");
      expect(after.updatedAt).toBeGreaterThan(s.updatedAt);
    });
  });

  describe("findActiveBuilderSession", () => {
    it("returns the most recent non-ended builder session", () => {
      upsertSession({ id: "ended", kind: "builder", projectId: "p1", title: "E", ended: true, updatedAt: 5 });
      upsertSession({ id: "group", kind: "group", projectId: "p1", title: "G", updatedAt: 4 });
      upsertSession({ id: "live", kind: "builder", projectId: "p1", title: "L", updatedAt: 3 });
      expect(findActiveBuilderSession("p1")?.id).toBe("live");
    });

    it("returns undefined when none qualify", () => {
      upsertSession({ id: "ended", kind: "builder", projectId: "p1", title: "E", ended: true });
      expect(findActiveBuilderSession("p1")).toBeUndefined();
    });
  });

  describe("removeSession", () => {
    beforeEach(() => seed());

    it("removes the session payload and its index entry", () => {
      removeSession("c1");
      expect(getSession("c1")).toBeUndefined();
      expect(listSessions("p1")).toEqual([]);
    });

    it("is a no-op for an unknown id", () => {
      expect(() => removeSession("ghost")).not.toThrow();
      expect(listSessions("p1")).toHaveLength(1);
    });
  });
});
