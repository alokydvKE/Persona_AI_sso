import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import Header from "../../../components/global/Header";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => navigateSpy.mockReset());

describe("Header", () => {
  describe("when logged out", () => {
    it("shows a Get Started button that routes to /login", async () => {
      const { user } = renderWithProviders(<Header />);
      const cta = screen.getByRole("button", { name: /get started/i });
      await user.click(cta);
      expect(navigateSpy).toHaveBeenCalledWith("/login");
    });

    it("does not show the authenticated nav", () => {
      renderWithProviders(<Header />);
      expect(screen.queryByRole("button", { name: /dashboard/i })).not.toBeInTheDocument();
    });
  });

  describe("when logged in", () => {
    beforeEach(() => authenticate());

    it("shows the nav and routes to the dashboard", async () => {
      const { user } = renderWithProviders(<Header />);
      await user.click(screen.getByRole("button", { name: /dashboard/i }));
      expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
    });

    it("renders the profile avatar instead of Get Started", () => {
      renderWithProviders(<Header />);
      expect(screen.queryByRole("button", { name: /get started/i })).not.toBeInTheDocument();
      // authenticate() stores firstName "Test" lastName "User" -> initials TU
      expect(screen.getByText("TU")).toBeInTheDocument();
    });
  });
});
