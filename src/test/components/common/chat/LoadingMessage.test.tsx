import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import LoadingMessage, {
  THINKING_PHRASE_INTERVAL_MS,
} from "../../../../components/common/Chat/LoadingMessage";

const PHRASES = ["Reading…", "Thinking…", "Writing…"];
const phrase = () => screen.getByTestId("thinking-phrase");
const tick = (times = 1) =>
  act(() => {
    vi.advanceTimersByTime(THINKING_PHRASE_INTERVAL_MS * times);
  });

describe("LoadingMessage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the first line at once and announces one steady label", () => {
    render(<LoadingMessage phrases={PHRASES} label="Personas are replying" />);
    expect(phrase()).toHaveTextContent("Reading…");
    expect(screen.getByRole("status")).toHaveTextContent("Personas are replying");
    // The rotating line is visual only, so it is not read out on every change.
    expect(phrase()).toHaveAttribute("aria-hidden", "true");
  });

  it("steps through the lines and holds on the last", () => {
    render(<LoadingMessage phrases={PHRASES} />);
    tick();
    expect(phrase()).toHaveTextContent("Thinking…");
    tick();
    expect(phrase()).toHaveTextContent("Writing…");
    tick(5);
    expect(phrase()).toHaveTextContent("Writing…");
  });

  it("starts over when given a different list", () => {
    const { rerender } = render(<LoadingMessage phrases={PHRASES} />);
    tick(2);
    expect(phrase()).toHaveTextContent("Writing…");

    rerender(<LoadingMessage phrases={["Uploading…", "Almost there…"]} />);
    expect(phrase()).toHaveTextContent("Uploading…");
    tick();
    expect(phrase()).toHaveTextContent("Almost there…");
  });

  it("keeps its place when re-rendered with the same lines", () => {
    const { rerender } = render(<LoadingMessage phrases={PHRASES} />);
    tick();
    rerender(<LoadingMessage phrases={[...PHRASES]} />);
    expect(phrase()).toHaveTextContent("Thinking…");
  });

  it("falls back to a single default line", () => {
    render(<LoadingMessage phrases={[]} />);
    expect(phrase()).toHaveTextContent("Thinking…");
    tick(3);
    expect(phrase()).toHaveTextContent("Thinking…");
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for a reply");
  });
});
