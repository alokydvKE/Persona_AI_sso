import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Collapse from "@/components/common/Collapse";

const shell = () => screen.queryByText("Details")?.closest("[data-state]") ?? null;

describe("Collapse", () => {
  it("doesn't mount content that has never been opened", () => {
    render(<Collapse open={false}>Details</Collapse>);
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("shows its content when open", () => {
    render(<Collapse open>Details</Collapse>);
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-state", "open");
    expect(shell()).not.toHaveAttribute("inert");
  });

  it("keeps content mounted but inert once closed, so it can animate shut", () => {
    const { rerender } = render(<Collapse open>Details</Collapse>);
    rerender(<Collapse open={false}>Details</Collapse>);
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-state", "closed");
    expect(shell()).toHaveAttribute("inert");
  });

  it("puts the class on the content box, not the animated shell", () => {
    render(
      <Collapse open className="border-t p-3">
        Details
      </Collapse>,
    );
    expect(screen.getByText("Details")).toHaveClass("border-t", "p-3");
  });
});
