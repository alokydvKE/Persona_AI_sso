import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { MessageComponent } from "../../../../components/common/Chat/Message";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const assistantMsg = { id: "a1", message: "Hello from the assistant", userType: "Assistant" as const };
const userMsg = { id: "u1", message: "My question", userType: "User" as const };

describe("MessageComponent", () => {
  it("renders an assistant message with its text", () => {
    renderWithProviders(<MessageComponent message={assistantMsg} isLastMessage />);
    expect(screen.getByText("Hello from the assistant")).toBeInTheDocument();
  });

  it("renders a user message with its text", () => {
    renderWithProviders(<MessageComponent message={userMsg} isLastMessage={false} />);
    expect(screen.getByText("My question")).toBeInTheDocument();
  });

  it("copies the message text to the clipboard", async () => {
    const writeSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const { user } = renderWithProviders(
      <MessageComponent message={assistantMsg} isLastMessage />,
    );
    await user.click(screen.getByRole("button"));
    expect(writeSpy).toHaveBeenCalledWith("Hello from the assistant");
  });

  it("invokes onEdit with the message text for a user message", async () => {
    const onEdit = vi.fn();
    const { user } = renderWithProviders(
      <MessageComponent message={userMsg} isLastMessage onEdit={onEdit} />,
    );
    // User bubble renders Edit then Copy; the first button is Edit.
    await user.click(screen.getAllByRole("button")[0]);
    expect(onEdit).toHaveBeenCalledWith("My question");
  });

  it("does not render an edit action when onEdit is absent", () => {
    renderWithProviders(<MessageComponent message={userMsg} isLastMessage />);
    // Only the Copy action remains.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
