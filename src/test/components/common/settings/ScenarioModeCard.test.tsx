import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioModeCard } from "../../../../components/common/Settings/ScenarioModeCard";

describe("ScenarioModeCard", () => {
  it("renders the title and description", () => {
    render(<ScenarioModeCard />);
    expect(screen.getByText("Scenario Mode")).toBeInTheDocument();
    expect(
      screen.getByText(/default analysis perspective/i),
    ).toBeInTheDocument();
  });

  it("offers all three scenario tabs with optimistic selected by default", () => {
    render(<ScenarioModeCard />);
    ["Optimistic", "Realistic", "Pessimistic"].forEach((label) =>
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: "Optimistic" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});
