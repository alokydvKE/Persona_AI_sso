import { useCallback, useEffect, useRef, useState } from "react";

/** One loaded turn tagged with its absolute position in the full transcript. */
export type PagedTurn<T> = { index: number; data: T };

export type HistoryPage<T> = { items: T[]; total: number };

export type HistoryPager<T> = {
  turns: PagedTurn<T>[];
  isInitialLoading: boolean;
  isError: boolean;
  ready: boolean;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
};

/**
 * Convert one newest-first page into chronological turns with absolute indices.
 * `descOffset` is how many newer turns precede this page (the request offset);
 * `grandTotal` is the full transcript count.
 */
function toChronological<T>(
  items: T[],
  descOffset: number,
  grandTotal: number,
): PagedTurn<T>[] {
  const len = items.length;
  const out: PagedTurn<T>[] = [];
  for (let j = 0; j < len; j++) {
    // Reverse the page: items[len-1-j] is the j-th oldest of this window.
    out.push({
      index: grandTotal - descOffset - len + j,
      data: items[len - 1 - j],
    });
  }
  return out;
}

/**
 * Windowed chat-history pager built for reverse infinite scroll.
 *
 * The history endpoint returns turns newest-first (offset 0 = the most recent
 * page). At entry this hook makes a SINGLE call (offset 0) for the newest
 * window, then pages backwards (offset += pageSize) to load OLDER turns as the
 * user scrolls up. Each newest-first page is reversed to chronological order and
 * every turn is tagged with its absolute index, so the rendered list stays
 * chronological (oldest → newest) and React keys stay stable across prepends.
 *
 * @param resetKey   conversation/group id — changing it reloads from scratch.
 * @param fetchPage  fetches one newest-first page and reports the grand total.
 * @param pageSize   turns per window.
 */
export function useHistoryPager<T>(
  resetKey: string | undefined,
  fetchPage: (offset: number, limit: number) => Promise<HistoryPage<T>>,
  pageSize = 20,
): HistoryPager<T> {
  const [turns, setTurns] = useState<PagedTurn<T>[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(false);
  const [isLoadingOlder, setLoadingOlder] = useState(false);
  const [isError, setError] = useState(false);
  const [ready, setReady] = useState(false);
  // Grand total of turns, and how many of the newest we've loaded so far. Kept
  // as state so `hasOlder` re-renders, and mirrored in refs for async reads.
  const [total, setTotal] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const totalRef = useRef(0);
  const loadedCountRef = useRef(0);

  // Guards against stale async writes after the key changes or unmount.
  const tokenRef = useRef(0);
  // Always call the latest fetcher without re-running the load effect.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  // Initial load: a single call for the newest window of the current key.
  useEffect(() => {
    const token = ++tokenRef.current;
    setTurns([]);
    setError(false);
    setReady(false);
    setTotal(0);
    setLoadedCount(0);
    totalRef.current = 0;
    loadedCountRef.current = 0;

    if (!resetKey) return;

    setInitialLoading(true);
    (async () => {
      try {
        const page = await fetchRef.current(0, pageSize);
        if (token !== tokenRef.current) return;
        const grandTotal = page.total;
        const count = page.items.length;
        totalRef.current = grandTotal;
        loadedCountRef.current = count;
        setTotal(grandTotal);
        setLoadedCount(count);
        setTurns(toChronological(page.items, 0, grandTotal));
        setReady(true);
      } catch {
        if (token === tokenRef.current) setError(true);
      } finally {
        if (token === tokenRef.current) setInitialLoading(false);
      }
    })();
  }, [resetKey, pageSize]);

  const loadOlder = useCallback(() => {
    if (isLoadingOlder) return;
    const loaded = loadedCountRef.current;
    const grandTotal = totalRef.current;
    if (loaded >= grandTotal) return;

    const token = tokenRef.current;
    setLoadingOlder(true);
    (async () => {
      try {
        const page = await fetchRef.current(loaded, pageSize);
        if (token !== tokenRef.current) return;
        const older = toChronological(page.items, loaded, grandTotal);
        loadedCountRef.current = loaded + page.items.length;
        setLoadedCount(loadedCountRef.current);
        setTurns((prev) => [...older, ...prev]);
      } catch {
        // Swallow: the user can scroll up again to retry.
      } finally {
        if (token === tokenRef.current) setLoadingOlder(false);
      }
    })();
  }, [isLoadingOlder, pageSize]);

  return {
    turns,
    isInitialLoading,
    isError,
    ready,
    hasOlder: ready && loadedCount < total,
    isLoadingOlder,
    loadOlder,
  };
}
