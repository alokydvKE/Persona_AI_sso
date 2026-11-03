import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import BuilderThinking from "../../../../components/common/Chat/BuilderThinking";
import { THINKING_PHRASE_INTERVAL_MS } from "../../../../components/common/Chat/LoadingMessage";

afterEach(() => vi.useRealTimers());

describe("BuilderThinking", () => {
  it("announces itself once and shows the first status line", () => {
    render(<BuilderThinking phrases={["Reading…", "Writing…"]} label="Persona builder is replying" />);
    expect(screen.getByRole("status")).toHaveTextContent("Persona builder is replying");
    expect(screen.getByTestId("builder-thinking-phrase")).toHaveTextContent("Reading…");
  });

  it("moves through the status lines and stays on the last", () => {
    vi.useFakeTimers();
    render(<BuilderThinking phrases={["Reading…", "Writing…"]} label="Replying" />);

    act(() => vi.advanceTimersByTime(THINKING_PHRASE_INTERVAL_MS));
    expect(screen.getByTestId("builder-thinking-phrase")).toHaveTextContent("Writing…");
    act(() => vi.advanceTimersByTime(THINKING_PHRASE_INTERVAL_MS * 3));
    expect(screen.getByTestId("builder-thinking-phrase")).toHaveTextContent("Writing…");
  });

  it("has the avatar blinking while it waits", () => {
    render(<BuilderThinking phrases={["Reading…"]} label="Replying" />);
    expect(screen.getByTestId("builder-avatar-eyes").getAttribute("class")).toMatch(/bot-blink/);
  });

  it("falls back to a generic line when given none", () => {
    render(<BuilderThinking phrases={[]} label="Replying" />);
    expect(screen.getByTestId("builder-thinking-phrase")).toHaveTextContent("Thinking…");
  });
});
