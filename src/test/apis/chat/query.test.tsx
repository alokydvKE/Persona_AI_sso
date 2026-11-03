import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { useChatList, useBuilderHistory } from "@/api/Chat/query";

beforeEach(() => authenticate());

describe("useChatList", () => {
  it("normalises and sorts builder and group chats newest-first", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              conversation_id: "b1",
              project_id: "p1",
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          group_chats: [
            {
              group_id: "g1",
              project_id: "p1",
              persona_ids: ["x", "y"],
              status: "active",
              created_at: "2026-02-01T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data!;
    expect(items).toHaveLength(2);
    // Group chat (Feb) sorts before the builder chat (Jan).
    expect(items[0]).toMatchObject({
      id: "g1",
      kind: "group",
      to: "/group-chat/g1",
      title: "Group chat · 2 personas",
    });
    expect(items[1]).toMatchObject({ id: "b1", kind: "builder", to: "/chat/b1" });
  });

  it("orders by last activity (updated_at), not creation time", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              // Created first, but messaged most recently -> should sort first.
              conversation_id: "b1",
              project_id: "p1",
              status: "active",
              title: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-03-01T00:00:00Z",
            },
          ],
          group_chats: [
            {
              group_id: "g1",
              project_id: "p1",
              persona_ids: ["x"],
              status: "active",
              title: null,
              created_at: "2026-02-01T00:00:00Z",
              updated_at: "2026-02-01T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data!;
    // b1's newer updated_at wins over g1's newer created_at.
    expect(items.map((i) => i.id)).toEqual(["b1", "g1"]);
    expect(items[0].updatedAt).toBe(Date.parse("2026-03-01T00:00:00Z"));
  });

  it("falls back to created_at when updated_at is missing", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              conversation_id: "b1",
              project_id: "p1",
              status: "active",
              title: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: null,
            },
          ],
          group_chats: [],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].updatedAt).toBe(
      Date.parse("2026-01-01T00:00:00Z"),
    );
  });

  it("prefers the server-provided title over the default label", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              conversation_id: "b1",
              project_id: "p1",
              status: "active",
              title: "Low-sugar hydration",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          group_chats: [],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].title).toBe("Low-sugar hydration");
  });

  it("is disabled without a projectId", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useChatList — waiting for a generated title", () => {
  /** Serve a chat list whose builder row gains a title after `afterCalls` calls. */
  const titleArrivesAfter = (afterCalls: number) => {
    let calls = 0;
    server.use(
      http.post(`${API_URL}persona/chat-list`, () => {
        calls += 1;
        return ok({
          builder_chats: [
            {
              conversation_id: "b1",
              project_id: "p1",
              status: "active",
              // Null until the backend's background naming job finishes.
              title: calls > afterCalls ? "Low-sugar hydration" : null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          group_chats: [],
        });
      }),
    );
    return () => calls;
  };

  it("picks up the title once the backend writes it, with no reload", async () => {
    titleArrivesAfter(1);
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(
      () => useChatList("p1", { awaitTitleFor: "b1" }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // First response has no title yet -> the local/default name stands.
    expect(result.current.data?.[0].hasServerTitle).toBe(false);

    // The poll picks up the generated one on its own.
    await waitFor(
      () => expect(result.current.data?.[0].title).toBe("Low-sugar hydration"),
      { timeout: 8000 },
    );
    expect(result.current.data?.[0].hasServerTitle).toBe(true);
  }, 15000);

  it("does not poll when no chat is waiting on a title", async () => {
    const calls = titleArrivesAfter(0);
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useChatList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const seen = calls();
    // A list nobody is waiting on must not put the app on a timer.
    await new Promise((r) => setTimeout(r, 3200));
    expect(calls()).toBe(seen);
  }, 15000);
});

describe("useBuilderHistory", () => {
  it("flattens each turn into user then assistant bubbles", async () => {
    server.use(
      http.post(`${API_URL}persona/chat/history`, () =>
        ok({
          messages: [{ user_message: "hi", response: "hello there" }],
          pagination: { total: 1 },
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useBuilderHistory("conv-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      message: "hi",
      userType: "User",
    });
    expect(result.current.messages[1]).toMatchObject({
      message: "hello there",
      userType: "Assistant",
    });
  });
});
