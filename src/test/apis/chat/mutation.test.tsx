import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { useBuilderChatStart, useBuilderChatMessage } from "@/api/Chat/mutation";

beforeEach(() => authenticate());

describe("useBuilderChatStart", () => {
  it("starts a conversation with flow=start and returns the opening turn", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}persona/chat/message`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({
          id: "conv-1",
          messages: [{ role: "assistant", content: "Hello!" }],
          building_persona: 0,
        });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useBuilderChatStart(), { wrapper: Wrapper });

    act(() => result.current.mutate({ projectId: "p1" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(body).toMatchObject({ flow: "start", project_id: "p1" });
    expect(result.current.data?.id).toBe("conv-1");
  });
});

describe("useBuilderChatMessage", () => {
  it("sends a message with flow=message and the conversation id", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}persona/chat/message`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({
          id: "conv-1",
          messages: [{ role: "assistant", content: "Got it." }],
          building_persona: 0,
        });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useBuilderChatMessage("conv-1"), {
      wrapper: Wrapper,
    });

    act(() => result.current.mutate({ message: "Tell me more" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(body).toMatchObject({
      flow: "message",
      conversation_id: "conv-1",
      message: "Tell me more",
    });
  });
});
