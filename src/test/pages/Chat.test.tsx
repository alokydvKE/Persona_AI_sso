import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ChatPage from "../../pages/Chat";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => navigateSpy.mockReset());

describe("ChatPage", () => {
  // With no :id route param and no active project, ChatEntry prompts the user
  // to pick a project from the dashboard.
  it("renders the no-project entry state when there is no project context", () => {
    renderWithProviders(<ChatPage />);
    expect(screen.getByText(/no project selected/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to dashboard/i }),
    ).toBeInTheDocument();
  });

  it("navigates to the dashboard from the entry prompt", async () => {
    const { user } = renderWithProviders(<ChatPage />);
    await user.click(screen.getByRole("button", { name: /go to dashboard/i }));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });
});
