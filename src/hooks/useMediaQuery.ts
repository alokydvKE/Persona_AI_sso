import { useCallback, useSyncExternalStore } from "react";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * Whether the CSS media `query` matches right now; re-renders when that
 * changes. False where matchMedia is unavailable (SSR, old test envs), and
 * correct on the first render, so a layout never flashes the other variant.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}
