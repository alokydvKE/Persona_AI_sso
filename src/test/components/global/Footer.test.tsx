import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import Footer from "../../../components/global/Footer";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Footer />
    </MemoryRouter>,
  );

beforeEach(() => navigateSpy.mockReset());

describe("Footer", () => {
  it("renders the brand name and tagline", () => {
    renderAt("/");
    expect(screen.getByText("PERSONA-AI")).toBeInTheDocument();
    expect(
      screen.getByText(/Multi-Persona AI for Strategic Future Planning/i),
    ).toBeInTheDocument();
  });

  it("navigates to the privacy policy when the link is clicked", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: "Privacy Policy" }));
    expect(navigateSpy).toHaveBeenCalledWith("/privacy-policy");
  });

  it("hides the privacy-policy link while on the privacy-policy page", () => {
    renderAt("/privacy-policy");
    expect(
      screen.queryByRole("button", { name: "Privacy Policy" }),
    ).not.toBeInTheDocument();
  });
});
