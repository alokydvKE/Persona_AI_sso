import { useEffect, useLayoutEffect, useRef } from "react";

type Options = {
  /** Returns the scrollable element (e.g. StickToBottom's scrollRef). */
  getScrollEl: () => HTMLElement | null;
  /** True once the transcript has loaded and the scroll element exists. */
  ready: boolean;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
  /** A value that increases whenever older turns are prepended (e.g. count). */
  signal: number;
  /** Distance from the top (px) at which to trigger a load. */
  threshold?: number;
};

/**
 * Loads older history when the user scrolls near the top of a chat transcript,
 * and preserves the viewport position after the prepend so the message the user
 * was reading stays put (no upward "jump").
 */
export function useLoadOlderOnScroll({
  getScrollEl,
  ready,
  hasOlder,
  isLoadingOlder,
  loadOlder,
  signal,
  threshold = 120,
}: Options) {
  // Latest values for the scroll handler, so the listener never re-binds mid-scroll.
  const stateRef = useRef({ hasOlder, isLoadingOlder, loadOlder });
  stateRef.current = { hasOlder, isLoadingOlder, loadOlder };

  // scrollHeight captured at trigger time, consumed once the prepend has rendered.
  const prevHeightRef = useRef<number | null>(null);

  useEffect(() => {
    const el = getScrollEl();
    if (!el) return;

    const onScroll = () => {
      const s = stateRef.current;
      if (!s.hasOlder || s.isLoadingOlder) return;
      if (el.scrollTop <= threshold) {
        // Anchor on the current height; restored in the layout effect below.
        prevHeightRef.current = el.scrollHeight;
        s.loadOlder();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // `ready` re-binds once the scroll element first exists.
  }, [getScrollEl, ready, threshold]);

  // After older turns render, restore scroll position by the height they added.
  useLayoutEffect(() => {
    if (prevHeightRef.current == null) return;
    const el = getScrollEl();
    if (!el) {
      prevHeightRef.current = null;
      return;
    }
    const delta = el.scrollHeight - prevHeightRef.current;
    prevHeightRef.current = null;
    if (delta > 0) el.scrollTop += delta;
  }, [signal, getScrollEl]);
}
