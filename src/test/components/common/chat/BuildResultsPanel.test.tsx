import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, envelopeError } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import BuildResultsPanel from "../../../../components/common/Chat/BuildResultsPanel";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

const makePersona = (over: Record<string, unknown> = {}) => ({
  persona_id: "pa",
  persona_name: "Curious Everyday Snack Optimizers",
  persona_index: 0,
  status: "ready",
  color: "green",
  final_coverage: 53.4,
  matched_respondents: 0,
  has_query_results: true,
  unique_studies: 7,
  unique_respondents: 3635,
  study_summary: [{ study_type_id: "S1", total_rows: 10, unique_respondent_count: 3635 }],
  evidence_by_category: [],
  insufficient_data: false,
  ...over,
});

const MEAL = makePersona({
  persona_id: "pb",
  persona_name: "Time-Pressed Meal Solution Balancers",
  persona_index: 1,
  color: "blue",
  final_coverage: 56,
  unique_studies: 4,
  unique_respondents: 1115,
});

function seedBuild(
  personas: unknown[],
  build: unknown = { job_id: "j1", status: "done", progress: 100 },
) {
  const insufficient = personas.filter(
    (p) => (p as { insufficient_data: boolean }).insufficient_data,
  ).length;
  server.use(
    http.post(`${API_URL}persona/chat/personas`, () =>
      ok({
        conversation_id: "c1",
        project_id: "p1",
        build,
        summary: {
          personas_created: personas.length,
          insufficient_data: insufficient,
          insufficient_data_threshold: 30,
          unique_studies: 0,
          unique_respondents: 0,
        },
        personas,
      }),
    ),
  );
}

function captureGroupStart() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${API_URL}persona/group-chat/message`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return ok({ group_id: "g1", message: "ok" });
    }),
  );
  return bodies;
}

const renderPanel = (props: Partial<Parameters<typeof BuildResultsPanel>[0]> = {}) =>
  renderWithProviders(
    <BuildResultsPanel
      open
      onOpenChange={vi.fn()}
      onOpenPersona={vi.fn()}
      conversationId="c1"
      {...props}
    />,
  );

/** Wide screens get the inline column; the default stub reports a narrow one. */
function wideScreen() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("BuildResultsPanel", () => {
  it("lists this chat's personas with their counts and coverage", async () => {
    seedBuild([makePersona(), MEAL]);
    renderPanel();

    expect(await screen.findByText("Curious Everyday Snack Optimizers")).toBeInTheDocument();
    expect(screen.getByText("Time-Pressed Meal Solution Balancers")).toBeInTheDocument();
    expect(screen.getByText("2 personas created · 0 with insufficient data")).toBeInTheDocument();
    expect(screen.getByText(/7 studies · 3,635 respondents/)).toBeInTheDocument();
    expect(screen.getByText("53%")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Coverage for Curious Everyday Snack Optimizers" }),
    ).toHaveAttribute("aria-valuenow", "53");
    // Cards carry no per-persona actions; the card itself opens the persona.
    expect(screen.queryByRole("button", { name: /evidence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /chat 1:1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it("opens a persona's evidence in the dashboard from its card", async () => {
    wideScreen();
    seedBuild([makePersona(), MEAL]);
    const onOpenPersona = vi.fn();
    const { user } = renderPanel({ onOpenPersona });

    await user.click(
      await screen.findByRole("button", { name: "Time-Pressed Meal Solution Balancers" }),
    );
    expect(onOpenPersona).toHaveBeenCalledWith("pb");
  });

  it("ticking a persona doesn't open it", async () => {
    wideScreen();
    seedBuild([makePersona()]);
    const onOpenPersona = vi.fn();
    const { user } = renderPanel({ onOpenPersona });

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Include Curious Everyday Snack Optimizers in the group chat",
      }),
    );
    expect(onOpenPersona).not.toHaveBeenCalled();
  });

  it("starts a group chat with everyone by default", async () => {
    seedBuild([makePersona(), MEAL]);
    const bodies = captureGroupStart();
    const { user } = renderPanel();

    await user.click(await screen.findByRole("button", { name: "Start group chat with all 2" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ flow: "start", project_id: "p1", persona_ids: ["pa", "pb"] });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/group-chat/g1", expect.anything()));
  });

  it("leaves unticked personas out of the group chat", async () => {
    seedBuild([makePersona(), MEAL]);
    const bodies = captureGroupStart();
    const { user } = renderPanel();

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Include Time-Pressed Meal Solution Balancers in the group chat",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Start chat with 1 persona" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ persona_ids: ["pa"] });
  });

  it("can't start a chat once everyone is unticked", async () => {
    seedBuild([makePersona()]);
    const { user } = renderPanel();

    await user.click(
      await screen.findByRole("checkbox", {
        name: "Include Curious Everyday Snack Optimizers in the group chat",
      }),
    );
    expect(screen.getByRole("button", { name: "Start group chat" })).toBeDisabled();
    expect(screen.getByText("Tick at least one persona to start a chat.")).toBeInTheDocument();
  });

  it("keeps a persona with too little data out of the group chat", async () => {
    seedBuild([
      makePersona(),
      makePersona({
        persona_id: "pc",
        persona_name: "Household-Fit Milk Navigators",
        insufficient_data: true,
        unique_studies: 1,
        unique_respondents: 12,
      }),
    ]);
    const bodies = captureGroupStart();
    const { user } = renderPanel();

    expect(
      await screen.findByText("2 personas created · 1 with insufficient data"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Include Household-Fit Milk Navigators in the group chat" }),
    ).toBeDisabled();

    // "All" means everyone who can chat: here, the one persona with data.
    await user.click(screen.getByRole("button", { name: "Start chat with 1 persona" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ persona_ids: ["pa"] });
  });

  it("holds the group chat while the build is still analysing", async () => {
    seedBuild(
      [makePersona({ has_query_results: false, final_coverage: null, unique_studies: 0, unique_respondents: 0, study_summary: [] })],
      { job_id: "j1", status: "running", progress: 40 },
    );
    renderPanel();

    expect(await screen.findByText("Analysing data…")).toBeInTheDocument();
    expect(screen.getByText("1 persona · analysing the data…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start group chat" })).toBeDisabled();
    expect(
      screen.getByText("Chats open once the build finishes analysing the data."),
    ).toBeInTheDocument();
  });

  it("says so when the chat hasn't built anything yet", async () => {
    seedBuild([], null);
    renderPanel();

    expect(await screen.findByText("No personas yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    server.use(
      http.post(`${API_URL}persona/chat/personas`, () => envelopeError(500, "boom"), { once: true }),
    );
    const { user } = renderPanel();

    const retry = await screen.findByRole("button", { name: /try again/i }, { timeout: 5000 });
    seedBuild([makePersona()]);
    await user.click(retry);
    expect(await screen.findByText("Curious Everyday Snack Optimizers")).toBeInTheDocument();
  });

  it("opens as an overlay on narrow screens, and steps aside for the dashboard", async () => {
    seedBuild([makePersona()]);
    const onOpenChange = vi.fn();
    const onOpenPersona = vi.fn();
    const { user } = renderPanel({ onOpenChange, onOpenPersona });

    const dialog = await screen.findByRole("dialog", { name: "Build results" });
    await user.click(
      await within(dialog).findByRole("button", { name: "Curious Everyday Snack Optimizers" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenPersona).toHaveBeenCalledWith("pa");
  });

  it("sits beside the chat on wide screens instead of covering it", async () => {
    wideScreen();
    seedBuild([makePersona()]);
    renderPanel();

    const panel = await screen.findByRole("complementary", { name: "Build results" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await within(panel).findByText("Curious Everyday Snack Optimizers")).toBeInTheDocument();
  });

  it("closes with Escape and is unreachable while closed", async () => {
    wideScreen();
    seedBuild([makePersona()]);
    const onOpenChange = vi.fn();
    const { user, rerender } = renderPanel({ onOpenChange });

    await screen.findByText("Curious Everyday Snack Optimizers");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <BuildResultsPanel
        open={false}
        onOpenChange={onOpenChange}
        onOpenPersona={vi.fn()}
        conversationId="c1"
      />,
    );
    // Hidden panels leave the tab order and the accessibility tree.
    expect(document.querySelector("aside")).toHaveAttribute("inert");
  });
});
