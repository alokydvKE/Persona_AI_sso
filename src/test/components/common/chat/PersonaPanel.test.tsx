import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, envelopeError } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import { getSession } from "@/lib/chatStore";
import PersonaPanel from "../../../../components/common/Chat/PersonaPanel";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

// A data-file persona (not a builder persona) so coverage/confidence show.
const makePersona = (over: Record<string, unknown> = {}) => ({
  persona_id: "pa",
  persona_name: "Alpha",
  status: "ready",
  confidence: "High",
  coverage: 85,
  persona_index: null,
  ...over,
});

const summary = {
  personas_created: 2,
  insufficient_data: 0,
  data_files: 1,
  unique_studies: 0,
  unique_respondents: 0,
};

function seedPersonas(personas: unknown[], dashboardPersonas: unknown[] = []) {
  server.use(
    http.post(`${API_URL}persona/list`, () => ok({ personas })),
    http.post(`${API_URL}persona/dashboard`, () => ok({ summary, personas: dashboardPersonas })),
  );
}

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("PersonaPanel", () => {
  it("renders the summary cards and persona list", async () => {
    seedPersonas([makePersona(), makePersona({ persona_id: "pb", persona_name: "Beta" })]);
    renderWithProviders(<PersonaPanel projectId="p1" />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Personas Created")).toBeInTheDocument();
    expect(screen.getByText("Data Files")).toBeInTheDocument();
  });

  it("labels each persona with its data source and filters by it", async () => {
    // Radix Select opens on pointer events jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    seedPersonas([
      makePersona({ data_source: "master" }),
      makePersona({ persona_id: "pb", persona_name: "Beta", data_source: "uploaded" }),
      makePersona({ persona_id: "pc", persona_name: "Gamma", data_source: "combined" }),
    ]);
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);

    await screen.findByText("Alpha");
    expect(screen.getByLabelText("Built from Master data")).toBeInTheDocument();
    expect(screen.getByLabelText("Built from My uploaded data")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Built from Master + my uploaded data"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("combobox", { name: "Filter personas by data source" }),
    );
    await user.click(await screen.findByRole("option", { name: /My uploaded data/ }));

    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("sorts by coverage by default, and by name or build order on request", async () => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    seedPersonas(
      [
        makePersona({ coverage: 60 }),
        makePersona({ persona_id: "pb", persona_name: "Beta", coverage: 90 }),
        makePersona({ persona_id: "pc", persona_name: "Gamma", coverage: 50 }),
        // A builder persona: no coverage of its own until the dashboard has one.
        makePersona({ persona_id: "pd", persona_name: "Delta", coverage: 0, persona_index: 0 }),
      ],
      [
        // The dashboard's evidence-backed figure wins over the list's.
        {
          persona_id: "pc",
          persona_name: "Gamma",
          insufficient_data: false,
          final_coverage: 95,
          study_summary: [],
          evidence_by_category: [],
          unique_studies: 1,
          unique_respondents: 40,
        },
      ],
    );
    const order = () =>
      screen
        .getAllByRole("checkbox", { name: /^Select (?!all)/ })
        .map((c) => c.getAttribute("aria-label")?.replace("Select ", ""));
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await waitFor(() => expect(order()).toEqual(["Gamma", "Beta", "Alpha", "Delta"]));

    await user.click(screen.getByRole("button", { name: "Sort: Coverage" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Name: A to Z" }));
    expect(order()).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
    expect(screen.getByRole("button", { name: "Sort: Name A–Z" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sort: Name A–Z" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Default order" }));
    expect(order()).toEqual(["Delta", "Alpha", "Beta", "Gamma"]);

    // The chosen row is marked in the menu.
    await user.click(screen.getByRole("button", { name: "Sort: Default" }));
    expect(
      await screen.findByRole("menuitemradio", { name: "Default order" }),
    ).toHaveAttribute("data-state", "checked");
  });

  it("sorts by lowest coverage, most respondents, most studies and Z to A", async () => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    const dash = (id: string, name: string, respondents: number, studies: number) => ({
      persona_id: id,
      persona_name: name,
      insufficient_data: false,
      final_coverage: null,
      study_summary: [],
      evidence_by_category: [],
      unique_studies: studies,
      unique_respondents: respondents,
    });
    seedPersonas(
      [
        makePersona({ coverage: 60 }),
        makePersona({ persona_id: "pb", persona_name: "Beta", coverage: 90 }),
        makePersona({ persona_id: "pc", persona_name: "Gamma", coverage: 50 }),
      ],
      [dash("pa", "Alpha", 10, 5), dash("pb", "Beta", 300, 1), dash("pc", "Gamma", 40, 3)],
    );
    const order = () =>
      screen
        .getAllByRole("checkbox", { name: /^Select (?!all)/ })
        .map((c) => c.getAttribute("aria-label")?.replace("Select ", ""));
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    const pick = async (current: string, option: string) => {
      await user.click(screen.getByRole("button", { name: `Sort: ${current}` }));
      await user.click(await screen.findByRole("menuitemradio", { name: option }));
    };

    await pick("Coverage", "Coverage: lowest first");
    expect(order()).toEqual(["Gamma", "Alpha", "Beta"]);
    await pick("Lowest coverage", "Most respondents");
    expect(order()).toEqual(["Beta", "Gamma", "Alpha"]);
    await pick("Respondents", "Most studies");
    expect(order()).toEqual(["Alpha", "Gamma", "Beta"]);
    await pick("Studies", "Name: Z to A");
    expect(order()).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("shows placeholders, not zeros, until the numbers arrive", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/list`, async () => {
        await gate;
        return ok({ personas: [makePersona()] });
      }),
      http.post(`${API_URL}persona/dashboard`, async () => {
        await gate;
        return ok({ summary: { ...summary, personas_created: 1 }, personas: [] });
      }),
    );
    renderWithProviders(<PersonaPanel projectId="p1" />);

    // Tiles and list are placeholders while loading — nothing reads as "0".
    expect(await screen.findAllByTestId("summary-value-skeleton")).toHaveLength(3);
    expect(screen.queryByText("No personas yet")).not.toBeInTheDocument();

    release();
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId("summary-value-skeleton")).not.toBeInTheDocument(),
    );
  });

  it("says the list failed to load, rather than that there are no personas", async () => {
    server.use(
      http.post(`${API_URL}persona/list`, () => envelopeError(500, "boom"), { once: true }),
      http.post(`${API_URL}persona/dashboard`, () => ok({ summary, personas: [] })),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);

    const retry = await screen.findByRole("button", { name: /try again/i }, { timeout: 5000 });
    expect(screen.getByText("Couldn't load the personas")).toBeInTheDocument();
    expect(screen.queryByText("No personas yet")).not.toBeInTheDocument();

    server.use(http.post(`${API_URL}persona/list`, () => ok({ personas: [makePersona()] })));
    await user.click(retry);
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("names a new group chat after its first persona, not all of them", async () => {
    seedPersonas([
      makePersona(),
      makePersona({ persona_id: "pb", persona_name: "Beta" }),
      makePersona({ persona_id: "pc", persona_name: "Gamma" }),
    ]);
    server.use(
      http.post(`${API_URL}persona/group-chat/message`, () => ok({ group_id: "g1", message: "ok" })),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("checkbox", { name: "Select all personas" }));
    await user.click(screen.getByRole("button", { name: /start group chat/i }));

    await waitFor(() => expect(getSession("g1")?.title).toBeDefined());
    expect(getSession("g1")?.title).toMatch(/^\S.* \+ 2 more$/);
  });

  it("shows an empty state when there are no personas", async () => {
    seedPersonas([]);
    renderWithProviders(<PersonaPanel projectId="p1" />);
    expect(await screen.findByText("No personas yet")).toBeInTheDocument();
  });

  it("starts a single-persona chat from a card", async () => {
    seedPersonas([makePersona()]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/group-chat/message`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ group_id: "g1", message: "ok" });
      }),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("button", { name: "Chat" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ flow: "start", persona_ids: ["pa"] });
  });

  it("selects personas and starts a group chat", async () => {
    seedPersonas([
      makePersona(),
      makePersona({ persona_id: "pb", persona_name: "Beta" }),
    ]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/group-chat/message`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ group_id: "g1", message: "ok" });
      }),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("checkbox", { name: "Select all personas" }));
    await user.click(screen.getByRole("button", { name: /start group chat/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ flow: "start", persona_ids: ["pa", "pb"] });
  });

  it("blocks selecting or chatting with an insufficient-data persona", async () => {
    seedPersonas(
      [makePersona(), makePersona({ persona_id: "pb", persona_name: "Beta" })],
      [
        {
          persona_id: "pa",
          persona_name: "Alpha",
          insufficient_data: true,
          study_summary: [],
          evidence_by_category: [],
          unique_studies: 0,
          unique_respondents: 2,
        },
        {
          persona_id: "pb",
          persona_name: "Beta",
          insufficient_data: false,
          study_summary: [],
          evidence_by_category: [],
          unique_studies: 1,
          unique_respondents: 50,
        },
      ],
    );
    let groupChatCalled = false;
    server.use(
      http.post(`${API_URL}persona/group-chat/message`, () => {
        groupChatCalled = true;
        return ok({ group_id: "g1", message: "ok" });
      }),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    // "ready" is misleading on a persona that isn't usable yet — hidden for it,
    // still shown for one with enough data.
    expect(screen.queryByText("ready")).toBeInTheDocument();
    const alphaRow = screen.getByText("Alpha").closest(".rounded-xl") as HTMLElement;
    expect(within(alphaRow).queryByText("ready")).not.toBeInTheDocument();

    const alphaCheckbox = screen.getByRole("checkbox", { name: "Select Alpha" });
    const betaCheckbox = screen.getByRole("checkbox", { name: "Select Beta" });
    expect(alphaCheckbox).toBeDisabled();
    expect(betaCheckbox).not.toBeDisabled();

    const chatButtons = screen.getAllByRole("button", { name: "Chat" });
    expect(chatButtons[0]).toBeDisabled(); // Alpha's
    expect(chatButtons[1]).not.toBeDisabled(); // Beta's
    await user.click(chatButtons[0]);
    expect(groupChatCalled).toBe(false);

    // "Select all" only picks up the persona with enough data.
    await user.click(screen.getByRole("checkbox", { name: "Select all personas" }));
    expect(alphaCheckbox).not.toBeChecked();
    expect(betaCheckbox).toBeChecked();
  });

  it("opens on one persona with its evidence showing and its row highlighted", async () => {
    const dash = (id: string, name: string, theme: string) => ({
      persona_id: id,
      persona_name: name,
      insufficient_data: false,
      final_coverage: 60,
      study_summary: [{ study_type_id: "S1", total_rows: 10, unique_respondent_count: 50 }],
      evidence_by_category: [
        { theme_id: `t-${id}`, theme_name: theme, items: [{ label: "Often", support_pct: 61, n: 40 }] },
      ],
      unique_studies: 1,
      unique_respondents: 50,
    });
    seedPersonas(
      [makePersona(), makePersona({ persona_id: "pb", persona_name: "Beta" })],
      [dash("pa", "Alpha", "Alpha theme"), dash("pb", "Beta", "Beta theme")],
    );
    renderWithProviders(<PersonaPanel projectId="p1" focusPersonaId="pb" />);

    // Only the focused persona's evidence is open.
    expect(await screen.findByText("Beta theme")).toBeInTheDocument();
    expect(screen.queryByText("Alpha theme")).not.toBeInTheDocument();

    const betaRow = screen.getByText("Beta").closest("[aria-current]") as HTMLElement;
    expect(betaRow).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Alpha").closest("[aria-current]")).toBeNull();
    expect(within(betaRow).getByRole("button", { name: /evidence/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("slides a persona's evidence open and shut", async () => {
    seedPersonas(
      [makePersona()],
      [
        {
          persona_id: "pa",
          persona_name: "Alpha",
          insufficient_data: false,
          final_coverage: 60,
          study_summary: [{ study_type_id: "S1", total_rows: 10, unique_respondent_count: 50 }],
          evidence_by_category: [
            { theme_id: "t1", theme_name: "Alpha theme", items: [{ label: "Often", support_pct: 61, n: 40 }] },
          ],
          unique_studies: 1,
          unique_respondents: 50,
        },
      ],
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    const toggle = await screen.findByRole("button", { name: /evidence/i });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const shell = () => screen.getByText("Alpha theme").closest("[data-state]");
    expect(shell()).toHaveAttribute("data-state", "open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Still there while it animates shut, but out of reach.
    expect(shell()).toHaveAttribute("data-state", "closed");
    expect(shell()).toHaveAttribute("inert");
  });

  it("marks the personas built by the chat the user is in", async () => {
    seedPersonas([makePersona(), makePersona({ persona_id: "pb", persona_name: "Beta" })]);
    renderWithProviders(<PersonaPanel projectId="p1" chatPersonaIds={new Set(["pb"])} />);

    await screen.findByText("Alpha");
    const marked = document.querySelectorAll("[data-from-chat]");
    expect(marked).toHaveLength(1);
    expect(within(marked[0] as HTMLElement).getByText("Beta")).toBeInTheDocument();
    // A thin edge, no visible label on the row — but named for assistive tech.
    expect(within(marked[0] as HTMLElement).getByText("Built in this chat")).toHaveClass("sr-only");
    // One small key above the list explains the edge.
    expect(screen.getByTestId("chat-personas-legend")).toHaveTextContent("Built in this chat");
  });

  it("marks nothing outside a builder chat", async () => {
    seedPersonas([makePersona()]);
    renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");
    expect(screen.queryByText("Built in this chat")).not.toBeInTheDocument();
    expect(document.querySelector("[data-from-chat]")).toBeNull();
    expect(screen.queryByTestId("chat-personas-legend")).not.toBeInTheDocument();
  });

  it("drops the key when none of this chat's personas are on screen", async () => {
    // The chat built a persona the source filter hides.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    seedPersonas([
      makePersona({ data_source: "master" }),
      makePersona({ persona_id: "pb", persona_name: "Beta", data_source: "uploaded" }),
    ]);
    const { user } = renderWithProviders(
      <PersonaPanel projectId="p1" chatPersonaIds={new Set(["pb"])} />,
    );
    expect(await screen.findByTestId("chat-personas-legend")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Filter personas by data source" }));
    await user.click(await screen.findByRole("option", { name: /Master data/ }));
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-personas-legend")).not.toBeInTheDocument();
  });

  it("ignores a focus persona that isn't in the project", async () => {
    seedPersonas([makePersona()]);
    renderWithProviders(<PersonaPanel projectId="p1" focusPersonaId="gone" />);
    await screen.findByText("Alpha");
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("renames a persona inline", async () => {
    seedPersonas([makePersona()]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/update`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({});
      }),
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("button", { name: "Rename persona" }));
    const input = screen.getByDisplayValue("Alpha");
    await user.clear(input);
    await user.type(input, "Renamed Persona");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ persona_id: "pa", persona_name: "Renamed Persona" });
  });

  it("narrows the list to insufficient-data personas from its tile", async () => {
    seedPersonas(
      [makePersona(), makePersona({ persona_id: "pb", persona_name: "Beta" })],
      [
        { persona_id: "pa", persona_name: "Alpha", insufficient_data: true, study_summary: [], evidence_by_category: [], unique_studies: 0, unique_respondents: 2 },
        { persona_id: "pb", persona_name: "Beta", insufficient_data: false, study_summary: [], evidence_by_category: [], unique_studies: 1, unique_respondents: 50 },
      ],
    );
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Beta");

    await user.click(screen.getByRole("button", { name: /Insufficient Data/ }));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    // Nothing here can be chatted with, so the group-chat footer is gone.
    expect(screen.queryByRole("button", { name: /start group chat/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Personas Created/ }));
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("lists the project's data files and downloads one", async () => {
    seedPersonas([makePersona()]);
    let downloadBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}projects/files/list`, () =>
        ok({
          files: [
            { file_id: "f1", file_name: "wave1.xlsx", status: "processed", rows: 120, created_at: "2026-09-01T10:00:00" },
          ],
        }),
      ),
      http.post(`${API_URL}projects/files/data/download`, async ({ request }) => {
        downloadBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(new Blob(["bytes"]), {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }),
    );
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("button", { name: /Data Files/ }));
    expect(await screen.findByText("wave1.xlsx")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download wave1.xlsx" }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(downloadBody).toMatchObject({ project_id: "p1", file_id: "f1" });
    expect(createObjectURL).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows an empty state when no data files were uploaded", async () => {
    seedPersonas([makePersona()]);
    server.use(http.post(`${API_URL}projects/files/list`, () => ok({ files: [] })));
    const { user } = renderWithProviders(<PersonaPanel projectId="p1" />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("button", { name: /Data Files/ }));
    expect(await screen.findByText("No data files yet")).toBeInTheDocument();
  });
});
