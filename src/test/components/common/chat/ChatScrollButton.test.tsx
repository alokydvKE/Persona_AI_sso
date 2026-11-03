import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatScrollButton from "../../../../components/common/Chat/ChatScrollButton";

// ChatScrollButton reads StickToBottom context; stub it with a mutable handle.
const { ctx } = vi.hoisted(() => ({
  ctx: { isAtBottom: false, scrollToBottom: vi.fn() },
}));
vi.mock("use-stick-to-bottom", () => ({
  useStickToBottomContext: () => ctx,
}));

beforeEach(() => {
  ctx.isAtBottom = false;
  ctx.scrollToBottom = vi.fn();
});

describe("ChatScrollButton", () => {
  it("renders nothing when already scrolled to the bottom", () => {
    ctx.isAtBottom = true;
    const { container } = render(<ChatScrollButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the jump-to-latest control when scrolled up", () => {
    render(<ChatScrollButton />);
    expect(screen.getByRole("button", { name: "Scroll to latest" })).toBeInTheDocument();
  });

  it("scrolls to the bottom when clicked", async () => {
    const user = userEvent.setup();
    render(<ChatScrollButton />);
    await user.click(screen.getByRole("button", { name: "Scroll to latest" }));
    expect(ctx.scrollToBottom).toHaveBeenCalledTimes(1);
  });
});
