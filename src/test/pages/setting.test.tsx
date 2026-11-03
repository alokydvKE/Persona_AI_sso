import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, envelopeError } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import SettingsPage from "@/pages/setting";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from "sonner";

type Settings = {
  scenario_mode: string;
  time_horizon: string;
  industry: string;
  domain: string;
  assumptions: string[];
  show_confidence_scores: boolean;
  show_data_badges: boolean;
  auto_expand_details: boolean;
};

const makeSettings = (over: Partial<Settings> = {}): Settings => ({
  scenario_mode: "realistic",
  time_horizon: "3_years",
  industry: "Technology",
  domain: "B2B SaaS",
  assumptions: ["Market grows steadily"],
  show_confidence_scores: true,
  show_data_badges: false,
  auto_expand_details: false,
  ...over,
});

beforeEach(() => authenticate());

describe("SettingsPage", () => {
  it("loads the settings and renders the populated form", async () => {
    server.use(
      http.post(`${API_URL}setting/get`, () => ok({ settings: makeSettings() })),
    );
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Realistic" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Technology")).toBeInTheDocument();
    expect(screen.getByText("Market grows steadily")).toBeInTheDocument();
  });

  it("adds an assumption and persists changes via Save", async () => {
    server.use(
      http.post(`${API_URL}setting/get`, () =>
        ok({ settings: makeSettings({ assumptions: [] }) }),
      ),
    );
    let saveBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}setting/save`, async ({ request }) => {
        saveBody = (await request.json()) as Record<string, unknown>;
        return ok({ settings: makeSettings({ assumptions: ["Fresh assumption"] }) });
      }),
    );

    const { user } = renderWithProviders(<SettingsPage />);
    await screen.findByRole("heading", { name: "Settings" });

    await user.type(
      screen.getByPlaceholderText("Add a new assumption..."),
      "Fresh assumption",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Fresh assumption")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save settings/i }));
    await waitFor(() => expect(saveBody).not.toBeNull());
    expect(saveBody).toMatchObject({ assumptions: ["Fresh assumption"] });
    expect(toast.success).toHaveBeenCalledWith("Settings saved");
  });

  it("resets to defaults", async () => {
    server.use(
      http.post(`${API_URL}setting/get`, () => ok({ settings: makeSettings() })),
    );
    let resetHit = false;
    server.use(
      http.post(`${API_URL}setting/reset`, () => {
        resetHit = true;
        return ok({ settings: makeSettings({ assumptions: [] }) });
      }),
    );

    const { user } = renderWithProviders(<SettingsPage />);
    await screen.findByRole("heading", { name: "Settings" });

    await user.click(screen.getByRole("button", { name: /reset to defaults/i }));
    await waitFor(() => expect(resetHit).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Settings reset to defaults");
  });

  it("shows an error message when settings fail to load", async () => {
    server.use(
      http.post(`${API_URL}setting/get`, () => envelopeError(500, "error")),
    );
    renderWithProviders(<SettingsPage />);
    expect(
      await screen.findByText(/couldn't load your settings/i),
    ).toBeInTheDocument();
  });
});
