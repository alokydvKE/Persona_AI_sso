import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { useGroupHistory, useGroupChatParticipants } from "@/api/GroupChat/query";

beforeEach(() => authenticate());

describe("useGroupHistory", () => {
  it("flattens a turn into a user bubble followed by persona replies", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({
          messages: [
            {
              user_message: "What matters most?",
              responses: [
                { persona_id: "a", persona_name: "Ann", response: "Price", evidence_tags: ["t"] },
                { persona_id: "b", persona_name: "Bob", response: "Quality" },
              ],
            },
          ],
          pagination: { total: 1 },
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGroupHistory("g1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0]).toMatchObject({ role: "user", message: "What matters most?" });
    expect(result.current.messages[1]).toMatchObject({ role: "persona", persona_name: "Ann" });
    expect(result.current.messages[2]).toMatchObject({ role: "persona", persona_name: "Bob" });
  });
});

describe("useGroupChatParticipants", () => {
  it("returns the participant list", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/participants`, () =>
        ok({
          participants: [
            { persona_id: "a", persona_name: "Ann", color: "green" },
            { persona_id: "b", persona_name: "Bob", color: "blue" },
          ],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGroupChatParticipants("g1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("is disabled without a groupId", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGroupChatParticipants(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
