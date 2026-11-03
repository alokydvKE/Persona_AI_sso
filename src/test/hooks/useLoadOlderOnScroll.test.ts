import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoadOlderOnScroll } from "../../hooks/useLoadOlderOnScroll";

/** A scrollable element whose scrollHeight we can control (jsdom's is read-only). */
function makeScrollEl(initial: { scrollTop: number; scrollHeight: number }) {
  const el = document.createElement("div");
  let height = initial.scrollHeight;
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
  el.scrollTop = initial.scrollTop;
  return { el, setHeight: (h: number) => (height = h) };
}

const baseProps = (overrides: Record<string, unknown>) => ({
  getScrollEl: () => null as HTMLElement | null,
  ready: true,
  hasOlder: true,
  isLoadingOlder: false,
  loadOlder: vi.fn(),
  signal: 0,
  threshold: 120,
  ...overrides,
});

describe("useLoadOlderOnScroll", () => {
  it("calls loadOlder when scrolled within the threshold", () => {
    const { el } = makeScrollEl({ scrollTop: 1000, scrollHeight: 2000 });
    const loadOlder = vi.fn();
    renderHook(() =>
      useLoadOlderOnScroll(baseProps({ getScrollEl: () => el, loadOlder })),
    );

    el.scrollTop = 50; // near the top
    act(() => el.dispatchEvent(new Event("scroll")));
    expect(loadOlder).toHaveBeenCalledTimes(1);
  });

  it("does not call loadOlder when scrolled past the threshold", () => {
    const { el } = makeScrollEl({ scrollTop: 1000, scrollHeight: 2000 });
    const loadOlder = vi.fn();
    renderHook(() =>
      useLoadOlderOnScroll(baseProps({ getScrollEl: () => el, loadOlder })),
    );

    el.scrollTop = 500;
    act(() => el.dispatchEvent(new Event("scroll")));
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it("does not call loadOlder when there are no older turns", () => {
    const { el } = makeScrollEl({ scrollTop: 0, scrollHeight: 2000 });
    const loadOlder = vi.fn();
    renderHook(() =>
      useLoadOlderOnScroll(
        baseProps({ getScrollEl: () => el, loadOlder, hasOlder: false }),
      ),
    );

    act(() => el.dispatchEvent(new Event("scroll")));
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it("does not call loadOlder while an older page is already loading", () => {
    const { el } = makeScrollEl({ scrollTop: 0, scrollHeight: 2000 });
    const loadOlder = vi.fn();
    renderHook(() =>
      useLoadOlderOnScroll(
        baseProps({ getScrollEl: () => el, loadOlder, isLoadingOlder: true }),
      ),
    );

    act(() => el.dispatchEvent(new Event("scroll")));
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it("restores scroll position after older turns are prepended", () => {
    const { el, setHeight } = makeScrollEl({ scrollTop: 1000, scrollHeight: 2000 });
    const loadOlder = vi.fn();
    const { rerender } = renderHook(
      (props) => useLoadOlderOnScroll(props),
      {
        initialProps: baseProps({ getScrollEl: () => el, loadOlder, signal: 0 }),
      },
    );

    // Trigger a load near the top (captures scrollHeight = 2000).
    el.scrollTop = 40;
    act(() => el.dispatchEvent(new Event("scroll")));

    // Simulate the prepend: content grows by 600px and the signal increments.
    setHeight(2600);
    rerender(baseProps({ getScrollEl: () => el, loadOlder, signal: 1 }));

    // Position is anchored: scrollTop shifts by the added height (40 + 600).
    expect(el.scrollTop).toBe(640);
  });

  it("is a no-op when there is no scroll element", () => {
    expect(() =>
      renderHook(() =>
        useLoadOlderOnScroll(baseProps({ getScrollEl: () => null })),
      ),
    ).not.toThrow();
  });
});
