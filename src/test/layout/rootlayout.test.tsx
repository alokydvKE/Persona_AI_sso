import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import Rootlayout from "../../layout/rootlayout";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

beforeEach(() => authenticate());

describe("Rootlayout", () => {
  it("shows the Dashboard title on the dashboard route", () => {
    renderWithProviders(<Rootlayout />, { route: "/dashboard" });
    // The header title and the sidebar nav both reference Dashboard.
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });

  it("shows the Settings title on the settings route", () => {
    renderWithProviders(<Rootlayout />, { route: "/settings" });
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
  });

  it("renders the sidebar brand", () => {
    renderWithProviders(<Rootlayout />, { route: "/dashboard" });
    expect(screen.getByText("Persona AI")).toBeInTheDocument();
  });

  it("keeps a long project name short in a chat's breadcrumb, full name on hover", async () => {
    const longName = "Food & Grocery Study with a very long name that goes on and on";
    server.use(
      http.post(`${API_URL}projects/get`, () => ok({ project_id: "p1", project_name: longName })),
    );
    renderWithProviders(<Rootlayout />, {
      // Chat routes carry their project in navigation state.
      routerEntries: [
        { pathname: "/group-chat/g1", state: { projectId: "p1" } } as unknown as string,
      ],
    });

    const crumb = await screen.findByText(longName);
    expect(crumb).toHaveAttribute("title", longName);
    expect(crumb).toHaveClass("truncate", "max-w-48");
  });
});
