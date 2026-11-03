import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypewriter } from "../../hooks/useTypewriter";

describe("useTypewriter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the full text immediately when disabled", () => {
    const { result } = renderHook(() => useTypewriter("hello world", false));
    expect(result.current).toBe("hello world");
  });

  it("reveals text word-by-word when enabled", () => {
    const { result } = renderHook(() => useTypewriter("one two three", true, 24));
    expect(result.current).toBe(""); // nothing revealed yet

    act(() => vi.advanceTimersByTime(24));
    expect(result.current).toBe("one ");

    act(() => vi.advanceTimersByTime(24));
    expect(result.current).toBe("one two ");

    act(() => vi.advanceTimersByTime(24));
    expect(result.current).toBe("one two three");
  });

  it("stops the interval once the whole text is revealed", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    renderHook(() => useTypewriter("a b", true, 10));
    act(() => vi.advanceTimersByTime(30));
    expect(clearSpy).toHaveBeenCalled();
  });

  it("handles empty text without revealing anything", () => {
    const { result } = renderHook(() => useTypewriter("", true));
    expect(result.current).toBe("");
  });
});
