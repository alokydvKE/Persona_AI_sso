import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SPEAKER_PREFERENCE_KEY, useSpeakerPreference } from "@/hooks/useSpeakerPreference";

describe("useSpeakerPreference", () => {
  it("is off by default and remembers the choice", () => {
    const { result } = renderHook(() => useSpeakerPreference());
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(SPEAKER_PREFERENCE_KEY)).toBe("on");

    const again = renderHook(() => useSpeakerPreference());
    expect(again.result.current[0]).toBe(true);

    act(() => again.result.current[1](false));
    expect(localStorage.getItem(SPEAKER_PREFERENCE_KEY)).toBe("off");
  });

  it("still works when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useSpeakerPreference());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
