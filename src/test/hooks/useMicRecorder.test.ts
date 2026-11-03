import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import {
  micErrorMessage,
  pickRecordingMimeType,
  recordingFilename,
  useMicRecorder,
} from "@/hooks/useMicRecorder";
import { transcribeAudio } from "@/api/Voice/voice";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/api/Voice/voice", () => ({ transcribeAudio: vi.fn() }));

const transcribe = vi.mocked(transcribeAudio);

class FakeRecorder {
  static supported = ["audio/webm;codecs=opus"];
  static failWithOptions = false;
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => FakeRecorder.supported.includes(type);

  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  chunk = new Blob(["x".repeat(4096)]);
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  stream: MediaStream;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    if (options && FakeRecorder.failWithOptions) throw new Error("unsupported options");
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: this.chunk });
    this.onstop?.();
  }
}

function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

let getUserMedia: ReturnType<typeof vi.fn>;
let track: { stop: ReturnType<typeof vi.fn> };

beforeEach(() => {
  FakeRecorder.supported = ["audio/webm;codecs=opus"];
  FakeRecorder.failWithOptions = false;
  FakeRecorder.instances = [];
  const fake = fakeStream();
  track = fake.track;
  getUserMedia = vi.fn().mockResolvedValue(fake.stream);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  transcribe.mockResolvedValue({ text: "  hello world ", duration_seconds: 1, latency_ms: 5 });
});

function render(options: Partial<Parameters<typeof useMicRecorder>[0]> = {}) {
  const onTranscript = vi.fn();
  const hook = renderHook(() =>
    useMicRecorder({ onTranscript, minDurationMs: 0, ...options }),
  );
  return { ...hook, onTranscript };
}

async function startRecording(result: { current: ReturnType<typeof useMicRecorder> }) {
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.status).toBe("recording");
  return FakeRecorder.instances.at(-1)!;
}

describe("useMicRecorder", () => {
  it("records, transcribes and hands back the trimmed transcript", async () => {
    const { result, onTranscript } = render();
    const recorder = await startRecording(result);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(recorder.mimeType).toBe("audio/webm;codecs=opus");

    act(() => result.current.stop());
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("hello world"));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const [blob, filename, signal] = transcribe.mock.calls[0];
    expect(blob.type).toBe("audio/webm;codecs=opus");
    expect(filename).toBe("recording.webm");
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(track.stop).toHaveBeenCalled();
  });

  it("toggle starts and then stops", async () => {
    const { result, onTranscript } = render();
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("recording"));
    act(() => result.current.toggle());
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
  });

  it("ignores start while already busy", async () => {
    const { result } = render();
    await startRecording(result);
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("tells the user when nothing was heard", async () => {
    transcribe.mockResolvedValueOnce({ text: "   ", duration_seconds: 1, latency_ms: 5 });
    const { result, onTranscript } = render();
    await startRecording(result);
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(onTranscript).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/didn't catch/i));
  });

  it("returns to idle when transcription fails", async () => {
    transcribe.mockRejectedValueOnce(new Error("Speech to text is unavailable"));
    const { result, onTranscript } = render();
    await startRecording(result);
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("discards a recording that is too short", async () => {
    const { result } = render({ minDurationMs: 60_000 });
    await startRecording(result);
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(transcribe).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/too short/i));
  });

  it("discards an empty recording", async () => {
    const { result } = render();
    const recorder = await startRecording(result);
    recorder.chunk = new Blob([]);
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("stops by itself at the maximum length", async () => {
    const { result, onTranscript } = render({ maxDurationMs: 20 });
    await startRecording(result);
    await waitFor(() => expect(onTranscript).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalled();
  });

  it.each([
    ["NotAllowedError", /blocked/i],
    ["NotFoundError", /no microphone/i],
    ["NotReadableError", /another app/i],
    ["WeirdError", /couldn't start/i],
  ])("explains a %s from the browser", async (name, message) => {
    const error = new Error("mic");
    error.name = name;
    getUserMedia.mockRejectedValueOnce(error);
    const { result } = render();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("idle");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(message));
  });

  it("falls back to the browser's default format when the preferred one fails", async () => {
    FakeRecorder.failWithOptions = true;
    const { result } = render();
    const recorder = await startRecording(result);
    expect(recorder.mimeType).toBe("audio/webm");
  });

  it("gives up cleanly when no recorder can be created", async () => {
    vi.stubGlobal(
      "MediaRecorder",
      Object.assign(
        function Broken() {
          throw new Error("nope");
        },
        { isTypeSupported: () => false },
      ),
    );
    const { result } = render();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
  });

  it("recovers from a recorder error", async () => {
    const { result } = render();
    const recorder = await startRecording(result);
    act(() => recorder.onerror?.());
    expect(result.current.status).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/recording failed/i));
  });

  it("cancel drops a transcription in progress", async () => {
    let signal: AbortSignal | undefined;
    let finish: (value: { text: string; duration_seconds: null; latency_ms: number }) => void = () => {};
    transcribe.mockImplementationOnce((_blob, _name, s) => {
      signal = s;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result, onTranscript } = render();
    await startRecording(result);
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.status).toBe("transcribing"));

    act(() => result.current.cancel());
    expect(signal?.aborted).toBe(true);
    expect(result.current.status).toBe("idle");

    await act(async () => finish({ text: "late", duration_seconds: null, latency_ms: 1 }));
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("cancel while recording releases the microphone without transcribing", async () => {
    const { result } = render();
    await startRecording(result);
    act(() => result.current.cancel());
    expect(result.current.status).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("releases a stream granted after cancel", async () => {
    let grant: (stream: MediaStream) => void = () => {};
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)));
    const { result } = render();
    let starting: Promise<void> | undefined;
    act(() => {
      starting = result.current.start();
    });
    expect(result.current.status).toBe("requesting");
    act(() => result.current.cancel());

    const late = fakeStream();
    await act(async () => {
      grant(late.stream);
      await starting;
    });
    expect(late.track.stop).toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it("turns the microphone off on unmount", async () => {
    const { result, unmount } = render();
    await startRecording(result);
    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("reports unsupported browsers", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = render();
    expect(result.current.supported).toBe(false);
    await act(async () => {
      await result.current.start();
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/isn't supported/i));
  });
});

describe("recording helpers", () => {
  it("picks the first supported format", () => {
    FakeRecorder.supported = ["audio/mp4"];
    expect(pickRecordingMimeType()).toBe("audio/mp4");
    FakeRecorder.supported = [];
    expect(pickRecordingMimeType()).toBeUndefined();
  });

  it("handles a browser without isTypeSupported", () => {
    vi.stubGlobal("MediaRecorder", function NoCheck() {});
    expect(pickRecordingMimeType()).toBeUndefined();
  });

  it("names the file after its container", () => {
    expect(recordingFilename("audio/webm;codecs=opus")).toBe("recording.webm");
    expect(recordingFilename("audio/mp4")).toBe("recording.m4a");
    expect(recordingFilename("audio/ogg")).toBe("recording.ogg");
    expect(recordingFilename("")).toBe("recording.webm");
  });

  it("maps unknown errors to a generic message", () => {
    expect(micErrorMessage("oops")).toMatch(/couldn't start/i);
    expect(micErrorMessage(new DOMException("x", "SecurityError"))).toMatch(/blocked/i);
  });
});
