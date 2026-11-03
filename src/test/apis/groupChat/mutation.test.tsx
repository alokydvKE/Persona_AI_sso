import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { getSession } from "@/lib/chatStore";
import { useStartGroupChat } from "@/api/GroupChat/mutation";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("useStartGroupChat", () => {
  it("starts a group chat, persists a session and navigates", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/message`, () =>
        ok({ group_id: "grp-1", message: "started" }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useStartGroupChat(), { wrapper: Wrapper });

    act(() =>
      result.current.mutate({
        projectId: "p1",
        personaIds: ["a", "b"],
        title: "Strategy session",
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(navigateSpy).toHaveBeenCalledWith("/group-chat/grp-1", {
      state: { projectId: "p1" },
    });
    expect(getSession("grp-1")).toMatchObject({
      kind: "group",
      title: "Strategy session",
      personaIds: ["a", "b"],
    });
  });
});
