import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { speechPlayer } from "@/lib/voice/speechPlayer";
import { useSpeechStatus } from "@/hooks/useSpeechStatus";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/api/Voice/voice", () => ({
  streamSpeech: vi.fn(() => new Promise(() => {})),
}));

describe("useSpeechStatus", () => {
  it("follows only its own message", () => {
    const mine = renderHook(() => useSpeechStatus("m1"));
    const other = renderHook(() => useSpeechStatus("m2"));
    expect(mine.result.current).toBe("idle");

    act(() => speechPlayer.enqueue({ id: "m1", text: "Hello." }));
    expect(mine.result.current).toBe("loading");
    expect(other.result.current).toBe("idle");

    act(() => speechPlayer.stop());
    expect(mine.result.current).toBe("idle");
  });
});
