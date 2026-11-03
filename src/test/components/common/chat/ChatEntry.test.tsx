import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import {
  API_URL,
  ok,
  envelopeError,
  dataStateResponse,
} from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import ChatEntry from "../../../../components/common/Chat/ChatEntry";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

const atProject = (state: Record<string, unknown> = { projectId: "p1" }) =>
  ({ routerEntries: [{ pathname: "/chat", state }] } as never);

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("ChatEntry", () => {
  it("prompts to pick a project when there is no project context", () => {
    renderWithProviders(<ChatEntry />);
    expect(screen.getByText(/no project selected/i)).toBeInTheDocument();
  });

  it("shows the persona dashboard when the project has personas", async () => {
    server.use(
      http.post(`${API_URL}persona/list`, () =>
        ok({ personas: [{ persona_id: "pa", persona_name: "Alpha", status: "ready", confidence: "High", coverage: 80, persona_index: null }] }),
      ),
      http.post(`${API_URL}persona/dashboard`, () =>
        ok({ summary: { personas_created: 1, insufficient_data: 0, data_files: 0 }, personas: [] }),
      ),
    );
    renderWithProviders(<ChatEntry />, atProject());

    expect(await screen.findByText("Personas")).toBeInTheDocument();
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("sends the user back to the upload step while the project is untouched", async () => {
    let chatCreated = false;
    server.use(
      http.post(`${API_URL}projects/data-state`, () =>
        ok(dataStateResponse({ upload_allowed: true, locked_reason: null })),
      ),
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat/message`, () => {
        chatCreated = true;
        return ok({ id: "conv-new", messages: [], building_persona: 0 });
      }),
    );
    // Rendered inside a route tree because the diversion is a <Navigate>, so it
    // is only observable as the destination actually rendering.
    renderWithProviders(
      <Routes>
        <Route path="/chat" element={<ChatEntry />} />
        <Route path="/upload/:projectId" element={<p>Upload your data</p>} />
      </Routes>,
      atProject(),
    );

    expect(await screen.findByText("Upload your data")).toBeInTheDocument();
    // The redirect must win the race: a conversation created here is one the
    // user never asked for, and it would be left behind on the upload step.
    expect(chatCreated).toBe(false);
  });

  it("does not divert back to upload when the upload step hands off", async () => {
    // Covers both handoffs — "Skip for now" and a pipeline that just finished.
    // The flag rides in route state, so it lasts exactly one navigation: without
    // it, either one bounces straight back to the step it just left.
    server.use(
      http.post(`${API_URL}projects/data-state`, () =>
        ok(dataStateResponse({ upload_allowed: true, locked_reason: null })),
      ),
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat/message`, () =>
        ok({ id: "conv-new", messages: [], building_persona: 0 }),
      ),
    );
    renderWithProviders(
      <ChatEntry />,
      atProject({ projectId: "p1", fromUpload: true }),
    );

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        "/chat/conv-new",
        expect.objectContaining({ replace: true }),
      ),
    );
    expect(navigateSpy).not.toHaveBeenCalledWith("/upload/p1", { replace: true });
  });

  it("opens the chat screen at once while the builder starts, then hands over its greeting", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat/message`, async () => {
        await gate;
        return ok({
          id: "conv-new",
          messages: [{ role: "assistant", content: "Hi! What shall we build?" }],
          building_persona: 0,
        });
      }),
    );
    renderWithProviders(<ChatEntry />, atProject({ projectId: "p1", forceNew: true }));

    // The chat layout, with the builder "typing" — not a full-screen loader.
    expect(await screen.findByText("Starting the persona builder")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Getting the persona builder ready…")).toBeDisabled();
    expect(screen.queryByText("Starting persona builder…")).not.toBeInTheDocument();

    release();
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/chat/conv-new", {
        state: {
          projectId: "p1",
          opening: { conversationId: "conv-new", message: "Hi! What shall we build?" },
        },
        replace: true,
      }),
    );
  });

  it("hands nothing over when the builder sent no greeting", async () => {
    server.use(
      http.post(`${API_URL}persona/chat/message`, () =>
        ok({ id: "conv-new", messages: [{ role: "assistant", content: "   " }], building_persona: 0 }),
      ),
    );
    renderWithProviders(<ChatEntry />, atProject({ projectId: "p1", forceNew: true }));

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/chat/conv-new", {
        state: { projectId: "p1" },
        replace: true,
      }),
    );
  });

  it("starts a new builder conversation when the project has no personas", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat/message`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ id: "conv-new", messages: [], building_persona: 0 });
      }),
    );
    renderWithProviders(<ChatEntry />, atProject());

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        "/chat/conv-new",
        expect.objectContaining({ state: { projectId: "p1" }, replace: true }),
      ),
    );
    // Nothing gates the chat on a data-source choice: no key is sent, and the
    // backend defaults the conversation to master. The dataset is changed from
    // the chat toolbar instead (see DataSourceControl).
    expect(body).toMatchObject({ flow: "start" });
    expect(body).not.toHaveProperty("data_source");
  });

  it("reopens the server's active builder chat instead of starting a new one", async () => {
    // Nothing in the local chat store (fresh login / other device) — the
    // server's chat list is what knows the chat is still active.
    let chatCreated = false;
    const builderChat = (id: string, status: string, updated_at: string) => ({
      conversation_id: id,
      project_id: "p1",
      status,
      title: null,
      created_at: "2026-09-01T10:00:00",
      updated_at,
    });
    server.use(
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            builderChat("conv-ended", "ended", "2026-09-03T10:00:00"),
            builderChat("conv-active", "active", "2026-09-02T10:00:00"),
          ],
          group_chats: [],
        }),
      ),
      http.post(`${API_URL}persona/chat/message`, () => {
        chatCreated = true;
        return ok({ id: "conv-new", messages: [], building_persona: 0 });
      }),
    );
    renderWithProviders(<ChatEntry />, atProject());

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        "/chat/conv-active",
        expect.objectContaining({ state: { projectId: "p1" }, replace: true }),
      ),
    );
    expect(chatCreated).toBe(false);
  });

  it("starts a new chat when every server builder chat has ended", async () => {
    server.use(
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              conversation_id: "conv-ended",
              project_id: "p1",
              status: "ended",
              title: null,
              created_at: "2026-09-01T10:00:00",
              updated_at: "2026-09-01T10:00:00",
            },
          ],
          group_chats: [],
        }),
      ),
      http.post(`${API_URL}persona/chat/message`, () =>
        ok({ id: "conv-new", messages: [], building_persona: 0 }),
      ),
    );
    renderWithProviders(<ChatEntry />, atProject());

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        "/chat/conv-new",
        expect.objectContaining({ replace: true }),
      ),
    );
  });

  it("surfaces a retry affordance when starting the builder fails", async () => {
    server.use(
      http.post(`${API_URL}persona/chat/message`, () => envelopeError(500, "error")),
    );
    // forceNew skips the persona list and goes straight to BuilderEntry.
    renderWithProviders(<ChatEntry />, atProject({ projectId: "p1", forceNew: true }));

    expect(
      await screen.findByText(/couldn't start the persona builder/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
