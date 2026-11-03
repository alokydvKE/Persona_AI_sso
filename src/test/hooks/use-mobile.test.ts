import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", {
    value: w,
    writable: true,
    configurable: true,
  });
};

describe("useIsMobile", () => {
  afterEach(() => setWidth(1024));

  it("returns false at desktop widths", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true below the 768px breakpoint", () => {
    setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reacts to a media-query change event", () => {
    let changeHandler: (() => void) | undefined;
    const mql = {
      matches: false,
      media: "",
      onchange: null,
      addEventListener: (_evt: string, cb: () => void) => (changeHandler = cb),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => mql));

    setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setWidth(500);
      changeHandler?.();
    });
    expect(result.current).toBe(true);
  });
});
