import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { chatIdFromPath, useActiveProjectId } from "../../hooks/useActiveProjectId";
import { upsertSession } from "@/lib/chatStore";

describe("chatIdFromPath", () => {
  it.each([
    ["/chat/abc", "abc"],
    ["/group-chat/xyz", "xyz"],
    ["/chat/abc/extra", "abc"],
  ])("extracts the id from %s", (path, expected) => {
    expect(chatIdFromPath(path)).toBe(expected);
  });

  it.each(["/", "/dashboard", "/settings", "/chat"])(
    "returns undefined for non-chat path %s",
    (path) => {
      expect(chatIdFromPath(path)).toBeUndefined();
    },
  );
});

function wrapperFor(entry: { pathname: string; state?: unknown }) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
}

describe("useActiveProjectId", () => {
  it("prefers the router navigation state projectId", () => {
    const { result } = renderHook(() => useActiveProjectId(), {
      wrapper: wrapperFor({ pathname: "/chat/c1", state: { projectId: "p9" } }),
    });
    expect(result.current).toBe("p9");
  });

  it("falls back to the persisted session when state is missing", () => {
    upsertSession({ id: "c1", kind: "builder", projectId: "p-stored", title: "x" });
    const { result } = renderHook(() => useActiveProjectId(), {
      wrapper: wrapperFor({ pathname: "/chat/c1" }),
    });
    expect(result.current).toBe("p-stored");
  });

  it("returns undefined when neither state nor a stored session exists", () => {
    const { result } = renderHook(() => useActiveProjectId(), {
      wrapper: wrapperFor({ pathname: "/chat/unknown" }),
    });
    expect(result.current).toBeUndefined();
  });
});
