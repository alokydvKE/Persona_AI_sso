import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import PersonaPanelDialog from "../../../../components/common/Chat/PersonaPanelDialog";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

beforeEach(() => authenticate());

describe("PersonaPanelDialog", () => {
  it("is hidden when the persona dialog flag is off", () => {
    renderWithProviders(<PersonaPanelDialog />, {
      preloadedState: { Project: { projects: [], personaDialog: false, personaDialogFocus: null } },
    });
    expect(screen.queryByRole("heading", { name: "Persona Panel" })).not.toBeInTheDocument();
  });

  it("renders the persona panel when the dialog flag is on", async () => {
    server.use(
      http.post(`${API_URL}persona/list`, () => ok({ personas: [] })),
      http.post(`${API_URL}persona/dashboard`, () =>
        ok({ summary: { personas_created: 0, insufficient_data: 0, data_files: 0 }, personas: [] }),
      ),
    );
    renderWithProviders(<PersonaPanelDialog />, {
      preloadedState: { Project: { projects: [], personaDialog: true, personaDialogFocus: null } },
    });

    expect(await screen.findByRole("heading", { name: "Persona Panel" })).toBeInTheDocument();
  });

  describe("marking the current chat's personas", () => {
    const persona = (id: string, name: string) => ({
      persona_id: id, persona_name: name, status: "ready", confidence: "High", coverage: 80, persona_index: null,
    });
    let chatPersonaRequests: string[] = [];

    beforeEach(() => {
      chatPersonaRequests = [];
      server.use(
        http.post(`${API_URL}persona/list`, () =>
          ok({ personas: [persona("pa", "Alpha"), persona("pb", "Beta")] }),
        ),
        http.post(`${API_URL}persona/dashboard`, () =>
          ok({ summary: { personas_created: 2, insufficient_data: 0, data_files: 0 }, personas: [] }),
        ),
        http.post(`${API_URL}persona/chat/personas`, async ({ request }) => {
          chatPersonaRequests.push(
            ((await request.json()) as { conversation_id: string }).conversation_id,
          );
          return ok({
            conversation_id: "c1",
            project_id: "p1",
            build: { job_id: "j1", status: "done", progress: 100 },
            summary: { personas_created: 1, insufficient_data: 0, insufficient_data_threshold: 30, unique_studies: 0, unique_respondents: 0 },
            personas: [{ ...persona("pb", "Beta"), color: "green", has_query_results: true, final_coverage: 50, matched_respondents: 0, unique_studies: 1, unique_respondents: 40, study_summary: [], evidence_by_category: [], insufficient_data: false }],
          });
        }),
      );
    });

    const openAt = (pathname: string) =>
      renderWithProviders(<PersonaPanelDialog />, {
        routerEntries: [{ pathname, state: { projectId: "p1" } }],
        preloadedState: { Project: { projects: [], personaDialog: true, personaDialogFocus: null } },
      } as never);

    it("marks the personas this builder chat built", async () => {
      openAt("/chat/c1");

      expect(await screen.findByTestId("chat-personas-legend")).toBeInTheDocument();
      expect(document.querySelectorAll("[data-from-chat]")).toHaveLength(1);
      const marked = document.querySelector("[data-from-chat]") as HTMLElement;
      expect(within(marked).getByText("Beta")).toBeInTheDocument();
      expect(chatPersonaRequests).toEqual(["c1"]);
    });

    it("marks nothing in a group chat", async () => {
      openAt("/group-chat/g1");

      expect(await screen.findByText("Alpha")).toBeInTheDocument();
      expect(screen.queryByText("Built in this chat")).not.toBeInTheDocument();
      expect(chatPersonaRequests).toEqual([]);
    });
  });
});
