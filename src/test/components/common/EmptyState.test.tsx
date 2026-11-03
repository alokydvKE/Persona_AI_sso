import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "@/components/common/EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No projects yet" />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Empty" description="Create your first project" />);
    expect(screen.getByText("Create your first project")).toBeInTheDocument();
  });

  it("renders the icon and action when provided", () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="icon" />}
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("does not render a description paragraph when none is given", () => {
    render(<EmptyState title="Only title" />);
    expect(screen.queryByText("Create your first project")).not.toBeInTheDocument();
  });
});
