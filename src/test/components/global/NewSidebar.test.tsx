import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NewAppSidebar } from "../../../components/global/NewSidebar";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

const renderSidebar = (entry: string | { pathname: string; state?: unknown }) =>
  renderWithProviders(
    <SidebarProvider>
      <NewAppSidebar />
    </SidebarProvider>,
    { routerEntries: [entry as string] },
  );

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("NewAppSidebar", () => {
  it("renders the brand and core navigation links", () => {
    renderSidebar("/dashboard");
    expect(screen.getByText("Persona AI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    // The projects dashboard is labelled Home; there is no separate Dashboard item.
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("does not show chat actions outside of chat routes", () => {
    renderSidebar("/dashboard");
    expect(screen.queryByText("New chat")).not.toBeInTheDocument();
  });

  it("shows chat actions and recents on a chat route", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            { conversation_id: "c1", project_id: "p1", status: "active", created_at: "2026-01-01T00:00:00Z" },
          ],
          group_chats: [],
        }),
      ),
    );
    renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });

    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText("Start group chat")).toBeInTheDocument();
    // Recents come from the chat-list query.
    expect(await screen.findByText("Persona chat")).toBeInTheDocument();
  });

  it("renders the server title and a rename affordance per recents row", async () => {
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [
            {
              conversation_id: "c1",
              project_id: "p1",
              status: "active",
              title: "Low-sugar hydration",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ],
          group_chats: [],
        }),
      ),
    );
    renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });

    // The backend-provided title wins over the default label.
    expect(await screen.findByText("Low-sugar hydration")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /chat options/i }),
    ).toBeInTheDocument();
  });

  it("opens the persona group-chat dialog via redux", async () => {
    const { user, store } = renderSidebar({
      pathname: "/chat/c1",
      state: { projectId: "p1" },
    });
    await user.click(screen.getByText("Start group chat"));
    expect(store.getState().Project.personaDialog).toBe(true);
  });

  describe("chat search", () => {
    const seedChats = () =>
      server.use(
        http.post(`${API_URL}persona/chat-list`, () =>
          ok({
            builder_chats: [
              { conversation_id: "c1", project_id: "p1", status: "active", title: "Snack pricing", created_at: "2026-01-02T00:00:00Z" },
              { conversation_id: "c2", project_id: "p1", status: "active", title: "Hydration drinks", created_at: "2026-01-01T00:00:00Z" },
            ],
            group_chats: [],
          }),
        ),
      );

    it("filters chats by title, case-insensitively", async () => {
      seedChats();
      const { user } = renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });
      await screen.findByText("Snack pricing");

      await user.click(screen.getByRole("button", { name: "Search chats" }));
      await user.type(screen.getByRole("textbox", { name: "Search chats" }), "  HYDRATION ");

      expect(screen.getByText("Hydration drinks")).toBeInTheDocument();
      expect(screen.queryByText("Snack pricing")).not.toBeInTheDocument();
    });

    it("says so when nothing matches", async () => {
      seedChats();
      const { user } = renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });
      await screen.findByText("Snack pricing");

      await user.click(screen.getByRole("button", { name: "Search chats" }));
      await user.type(screen.getByRole("textbox", { name: "Search chats" }), "zzz");

      expect(screen.getByText("No chats match “zzz”")).toBeInTheDocument();
    });

    it("clears and closes on Escape, restoring the full list", async () => {
      seedChats();
      const { user } = renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });
      await screen.findByText("Snack pricing");

      await user.click(screen.getByRole("button", { name: "Search chats" }));
      const input = screen.getByRole("textbox", { name: "Search chats" });
      expect(input).toHaveFocus();
      await user.type(input, "snack{Escape}");

      expect(screen.queryByRole("textbox", { name: "Search chats" })).not.toBeInTheDocument();
      expect(screen.getByText("Snack pricing")).toBeInTheDocument();
      expect(screen.getByText("Hydration drinks")).toBeInTheDocument();
    });

    it("offers no search when there are no chats", async () => {
      server.use(
        http.post(`${API_URL}persona/chat-list`, () => ok({ builder_chats: [], group_chats: [] })),
      );
      renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });

      expect(await screen.findByText("No chats yet")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Search chats" })).not.toBeInTheDocument();
    });
  });

  it.each([/new chat/i, /start group chat/i])(
    "shows no hover hint on %s while the sidebar is expanded",
    async (name) => {
      server.use(
        http.post(`${API_URL}persona/chat-list`, () => ok({ builder_chats: [], group_chats: [] })),
      );
      const { user } = renderSidebar({ pathname: "/chat/c1", state: { projectId: "p1" } });

      await user.hover(screen.getByRole("button", { name }));
      await new Promise((r) => setTimeout(r, 300));
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    },
  );

  it("disables New chat until a project is known", () => {
    renderSidebar("/chat");
    expect(screen.getByRole("button", { name: /new chat/i })).toBeDisabled();
  });
});
