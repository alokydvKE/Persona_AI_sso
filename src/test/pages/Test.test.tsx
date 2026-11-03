import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import PersonaAILandingPage from "../../pages/Test";

describe("PersonaAILandingPage", () => {
  it("renders the hero and primary value proposition", () => {
    renderWithProviders(<PersonaAILandingPage />);
    expect(
      screen.getByRole("heading", { name: /Enterprise-Grade Decision Intelligence/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Expert AI Personas")).toBeInTheDocument();
  });

  it("renders the three feature cards", () => {
    renderWithProviders(<PersonaAILandingPage />);
    expect(screen.getByText("Group Discussions")).toBeInTheDocument();
    expect(screen.getByText("Data-Driven Insights")).toBeInTheDocument();
    expect(screen.getByText("Scenario Planning")).toBeInTheDocument();
  });

  it("renders the demo-request form", () => {
    renderWithProviders(<PersonaAILandingPage />);
    expect(screen.getByPlaceholderText("Work email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request demo/i })).toBeInTheDocument();
  });
});
