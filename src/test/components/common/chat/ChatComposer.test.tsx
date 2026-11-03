import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ChatComposer from "../../../../components/common/Chat/ChatComposer";

const setup = (props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) =>
  renderWithProviders(
    <ChatComposer
      value=""
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  );

describe("ChatComposer", () => {
  it("shows the placeholder text", () => {
    setup({ placeholder: "Describe your persona" });
    expect(screen.getByPlaceholderText("Describe your persona")).toBeInTheDocument();
  });

  it("relays typing to onChange", async () => {
    const onChange = vi.fn();
    const { user } = setup({ onChange });
    await user.type(screen.getByRole("textbox"), "h");
    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("disables the send button when the value is empty", () => {
    setup({ value: "" });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables send and submits when there is text", async () => {
    const onSubmit = vi.fn();
    const { user } = setup({ value: "hello", onSubmit });
    const send = screen.getByRole("button");
    expect(send).toBeEnabled();
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the ended placeholder and disables input when disabled", () => {
    setup({ value: "hello", disabled: true });
    expect(screen.getByPlaceholderText("This chat has ended")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables send while a reply is in flight", () => {
    setup({ value: "hello", isSending: true });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders tools beside the send button without submitting", async () => {
    const onSubmit = vi.fn();
    const onTool = vi.fn();
    const { user } = setup({
      value: "hello",
      onSubmit,
      rightSlot: (
        <button type="button" onClick={onTool}>
          Attach
        </button>
      ),
    });
    await user.click(screen.getByRole("button", { name: "Attach" }));
    expect(onTool).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
