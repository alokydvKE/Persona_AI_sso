import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate, makeProject } from "@/test/factories";
import DashboardPage from "../../pages/Dashboard";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

beforeEach(() => authenticate());

describe("DashboardPage", () => {
  it("loads and displays projects from the API", async () => {
    server.use(
      http.post(`${API_URL}projects/list`, () =>
        ok({
          projects: [
            makeProject({ project_id: "p1", project_name: "Alpha Study" }),
            makeProject({ project_id: "p2", project_name: "Beta Study" }),
          ],
          pagination: { total: 2, total_pages: 1, offset: 0, limit: 10 },
        }),
      ),
    );

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Alpha Study")).toBeInTheDocument();
    expect(screen.getByText("Beta Study")).toBeInTheDocument();
  });

  it("shows an empty state when the API returns no projects", async () => {
    server.use(
      http.post(`${API_URL}projects/list`, () =>
        ok({ projects: [], pagination: { total: 0, total_pages: 0 } }),
      ),
    );

    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("No projects found")).toBeInTheDocument();
  });

  it("issues a debounced search request for terms of 3+ characters", async () => {
    let lastSearch: unknown;
    server.use(
      http.post(`${API_URL}projects/list`, async ({ request }) => {
        lastSearch = ((await request.json()) as { search: string }).search;
        return ok({ projects: [], pagination: { total: 0, total_pages: 0 } });
      }),
    );

    const { user } = renderWithProviders(<DashboardPage />);
    await user.type(screen.getByPlaceholderText("Find the project..."), "beverage");

    await waitFor(() => expect(lastSearch).toBe("beverage"));
  });
});
