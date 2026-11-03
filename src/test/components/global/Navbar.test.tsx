import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import Navbar from "../../../components/global/Navbar";

// Navbar renders ProfileDropDown, which reads the stored user.
beforeEach(() => authenticate());

describe("Navbar", () => {
  it("renders the brand and primary navigation links", () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByText("Persona AI")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("renders the profile avatar from the stored user", () => {
    renderWithProviders(<Navbar />);
    expect(screen.getByText("TU")).toBeInTheDocument();
  });
});
