import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { useSpeechStatus } from "@/hooks/useSpeechStatus";
import GroupMessage from "../../../../components/common/Chat/GroupChat/GroupMessage";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/useSpeechStatus", () => ({ useSpeechStatus: vi.fn(() => "idle") }));

const status = vi.mocked(useSpeechStatus);

const reply: GroupMessageT = {
  id: "m1",
  role: "persona",
  persona_name: "Ann",
  message: "Affordability matters.",
};

describe("GroupMessage read-aloud action", () => {
  it("is hidden without onSpeak, for user messages, and for empty replies", () => {
    const { rerender } = renderWithProviders(<GroupMessage message={reply} />);
    expect(screen.queryByRole("button", { name: /read aloud/i })).not.toBeInTheDocument();

    rerender(<GroupMessage message={{ ...reply, role: "user" }} onSpeak={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /read aloud/i })).not.toBeInTheDocument();

    rerender(<GroupMessage message={{ ...reply, message: "  " }} onSpeak={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /read aloud/i })).not.toBeInTheDocument();
  });

  it("plays the reply when clicked", async () => {
    const onSpeak = vi.fn();
    const { user } = renderWithProviders(<GroupMessage message={reply} onSpeak={onSpeak} />);
    const button = screen.getByRole("button", { name: "Read aloud" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(onSpeak).toHaveBeenCalledWith(reply);
  });

  it.each([
    ["loading", "Stop loading audio"],
    ["playing", "Stop reading"],
  ] as const)("shows the %s state", (state, label) => {
    status.mockReturnValue(state);
    renderWithProviders(<GroupMessage message={reply} onSpeak={vi.fn()} />);
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    expect(status).toHaveBeenCalledWith("m1");
  });
});
