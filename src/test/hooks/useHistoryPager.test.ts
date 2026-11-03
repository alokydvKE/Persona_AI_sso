import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useHistoryPager, type HistoryPage } from "../../hooks/useHistoryPager";

/** A page arrives newest-first; the hook reverses it to chronological order. */
const page = (items: string[], total: number): HistoryPage<string> => ({
  items,
  total,
});

describe("useHistoryPager", () => {
  it("does not fetch when resetKey is undefined", () => {
    const fetchPage = vi.fn();
    const { result } = renderHook(() => useHistoryPager(undefined, fetchPage, 3));
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.turns).toEqual([]);
    expect(result.current.ready).toBe(false);
  });

  it("loads the newest window and orders it chronologically with absolute indices", async () => {
    // newest-first page of 3 out of a 5-turn transcript.
    const fetchPage = vi.fn().mockResolvedValue(page(["t3", "t2", "t1"], 5));
    const { result } = renderHook(() => useHistoryPager("k1", fetchPage, 3));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(fetchPage).toHaveBeenCalledWith(0, 3);
    expect(result.current.turns).toEqual([
      { index: 2, data: "t1" },
      { index: 3, data: "t2" },
      { index: 4, data: "t3" },
    ]);
    expect(result.current.hasOlder).toBe(true);
    expect(result.current.isInitialLoading).toBe(false);
  });

  it("prepends older turns when loadOlder is called", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(["t3", "t2", "t1"], 5))
      .mockResolvedValueOnce(page(["t0b", "t0a"], 5));
    const { result } = renderHook(() => useHistoryPager("k1", fetchPage, 3));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.loadOlder());

    await waitFor(() => expect(result.current.turns).toHaveLength(5));
    expect(fetchPage).toHaveBeenNthCalledWith(2, 3, 3);
    expect(result.current.turns.map((t) => t.data)).toEqual([
      "t0a",
      "t0b",
      "t1",
      "t2",
      "t3",
    ]);
    expect(result.current.hasOlder).toBe(false);
  });

  it("does not fetch older pages once everything is loaded", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(["t2", "t1"], 2));
    const { result } = renderHook(() => useHistoryPager("k1", fetchPage, 3));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.hasOlder).toBe(false);
    act(() => result.current.loadOlder());
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("flags an error when the initial fetch rejects", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useHistoryPager("k1", fetchPage, 3));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.ready).toBe(false);
    expect(result.current.turns).toEqual([]);
  });

  it("reloads from scratch when resetKey changes", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(["a2", "a1"], 2))
      .mockResolvedValueOnce(page(["b1"], 1));
    const { result, rerender } = renderHook(
      ({ key }) => useHistoryPager(key, fetchPage, 3),
      { initialProps: { key: "k1" } },
    );
    await waitFor(() => expect(result.current.turns).toHaveLength(2));

    rerender({ key: "k2" });
    await waitFor(() => expect(result.current.turns).toEqual([{ index: 0, data: "b1" }]));
  });
});
