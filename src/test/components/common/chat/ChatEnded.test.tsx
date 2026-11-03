import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatEnded from "../../../../components/common/Chat/ChatEnded";

describe("ChatEnded", () => {
  it("shows the default ended message", () => {
    render(<ChatEnded />);
    expect(screen.getByText("This conversation has ended")).toBeInTheDocument();
  });

  it("shows a custom message", () => {
    render(<ChatEnded message="This discussion is closed." />);
    expect(screen.getByText("This discussion is closed.")).toBeInTheDocument();
  });

  it("exposes a polite status region for assistive tech", () => {
    render(<ChatEnded />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("offers no action unless given one", () => {
    render(<ChatEnded />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the given next step", async () => {
    const onClick = vi.fn();
    render(<ChatEnded action={{ label: "Start a new build", onClick }} />);
    await userEvent.click(screen.getByRole("button", { name: "Start a new build" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
