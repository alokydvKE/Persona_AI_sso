import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import PrivacyPolicyPage from "../../pages/Privacy-policy";

describe("PrivacyPolicyPage", () => {
  it("renders the privacy policy hero and effective date", () => {
    renderWithProviders(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/Effective Date: May 29, 2026/i)).toBeInTheDocument();
  });

  it("renders all policy sections including contact details", () => {
    renderWithProviders(<PrivacyPolicyPage />);
    expect(screen.getByText("1. Introduction")).toBeInTheDocument();
    expect(screen.getByText("2. Information We Collect")).toBeInTheDocument();
    expect(screen.getByText("10. Contact Us")).toBeInTheDocument();
    expect(screen.getByText("support@persona.ai")).toBeInTheDocument();
  });
});
