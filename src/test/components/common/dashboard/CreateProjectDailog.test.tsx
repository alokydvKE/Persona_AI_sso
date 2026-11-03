import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import CreateProjectDailog from "../../../../components/common/Dashboard/CreateProjectDailog";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("CreateProjectDailog", () => {
  it("opens the dialog from the trigger", async () => {
    const { user } = renderWithProviders(<CreateProjectDailog />);
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(await screen.findByRole("heading", { name: "Create Project" })).toBeInTheDocument();
    expect(screen.getByText("Brand Representative")).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    const { user } = renderWithProviders(<CreateProjectDailog />);
    await user.click(screen.getByRole("button", { name: /create project/i }));

    const submit = document.querySelector(
      '[data-test-id="SUBMIT_PROJECT"]',
    ) as HTMLElement;
    await user.click(submit);

    expect(await screen.findByText(/title must be at least 4 characters/i)).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("creates a project and opens its data-upload step on success", async () => {
    server.use(
      http.post(`${API_URL}projects/create`, () => ok({ project_id: "new-99" })),
    );
    const { user } = renderWithProviders(<CreateProjectDailog />);
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await user.type(
      screen.getByPlaceholderText("e.g. EverSip Persona Study"),
      "Beverage Study",
    );
    await user.type(
      screen.getByPlaceholderText("e.g. EverSip Persona Study is about..."),
      "Research into soft drink buyers",
    );

    await user.click(
      document.querySelector('[data-test-id="SUBMIT_PROJECT"]') as HTMLElement,
    );

    // A new project goes to the upload step first (it hands off to the builder
    // chat afterwards); the id is in the path so the page survives a refresh.
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/upload/new-99", {
        state: { projectId: "new-99", fromCreate: true },
      }),
    );
  });
});
