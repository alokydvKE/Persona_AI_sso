import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, delay } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import ProfileDropDown from "../../../components/global/ProfileDropDown";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate(); // stores user blob (firstName "Test", lastName "User")
});

describe("ProfileDropDown", () => {
  it("shows the user initials on the trigger", () => {
    renderWithProviders(<ProfileDropDown />);
    expect(screen.getByText("TU")).toBeInTheDocument();
  });

  it("opens the menu and navigates to settings", async () => {
    const { user } = renderWithProviders(<ProfileDropDown />);
    await user.click(screen.getByText("TU"));

    expect(await screen.findByText("Test User")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(navigateSpy).toHaveBeenCalledWith("/settings");
  });

  it("initiates a logout request when Logout is clicked", async () => {
    // Keep the request pending: in the real app onSuccess navigates away and
    // unmounts this component; with navigate mocked, letting it resolve would
    // re-render against cleared storage and crash. The full logout teardown is
    // covered in Auth/mutation.test. Here we assert the request is fired.
    let logoutHit = false;
    server.use(
      http.post(`${API_URL}users/logout`, async () => {
        logoutHit = true;
        await delay("infinite");
        return ok({ message: "bye" });
      }),
    );

    const { user } = renderWithProviders(<ProfileDropDown />);
    await user.click(screen.getByText("TU"));
    await user.click(await screen.findByRole("menuitem", { name: /logout/i }));

    await waitFor(() => expect(logoutHit).toBe(true));
  });
});
