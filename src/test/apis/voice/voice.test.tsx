import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test/msw/server";
import { API_URL, envelopeError, ok } from "@/test/msw/handlers";
import { VOICE_ENDPOINTS } from "@/api/Voice/endpoints";
import { authenticate } from "@/test/factories";
import { createHookWrapper } from "@/test/test-utils";
import { streamSpeech, transcribeAudio, useVoiceConfig } from "@/api/Voice/voice";
import type { AudioChunk } from "@/lib/voice/pcm";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => authenticate("voice-token"));

describe("useVoiceConfig", () => {
  it("loads which voice features are available", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}${VOICE_ENDPOINTS.config}`, async ({ request }) => {
        body = await request.json();
        return ok({ stt: { enabled: true }, tts: { enabled: false } });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useVoiceConfig(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ stt: { enabled: true }, tts: { enabled: false } });
    expect(body).toEqual({ token: "voice-token" });
  });

  it("fails quietly so the controls just stay hidden", async () => {
    server.use(http.post(`${API_URL}${VOICE_ENDPOINTS.config}`, () => envelopeError(500, "boom")));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useVoiceConfig(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("doesn't fetch without a logged-in user", () => {
    localStorage.clear();
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useVoiceConfig(), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("transcribeAudio", () => {
  it("uploads the clip with the token as multipart form data", async () => {
    // request.formData() can't parse jsdom's File under undici, so read the raw body.
    let contentType = "";
    let raw = "";
    server.use(
      http.post(`${API_URL}${VOICE_ENDPOINTS.stt}`, async ({ request }) => {
        contentType = request.headers.get("content-type") ?? "";
        raw = await request.text();
        return ok({ text: "hi there", duration_seconds: 1, latency_ms: 10 });
      }),
    );

    const result = await transcribeAudio(
      new Blob(["abc"], { type: "audio/webm" }),
      "recording.webm",
    );
    expect(result.text).toBe("hi there");
    expect(contentType).toMatch(/^multipart\/form-data/);
    expect(raw).toMatch(/name="token"\r\n\r\nvoice-token/);
    // jsdom's serializer drops the filename; browsers send it.
    expect(raw).toMatch(/name="audio"; filename="[^"]+"\r\nContent-Type: audio\/webm/);
  });

  it("toasts and throws on an error envelope", async () => {
    server.use(
      http.post(`${API_URL}${VOICE_ENDPOINTS.stt}`, () => envelopeError(415, "Unsupported audio format")),
    );
    await expect(transcribeAudio(new Blob(["abc"]), "recording.webm")).rejects.toThrow(
      "Unsupported audio format",
    );
    expect(toast.error).toHaveBeenCalledWith("Unsupported audio format");
  });
});

describe("streamSpeech", () => {
  const TTS = `${API_URL}${VOICE_ENDPOINTS.tts}`;
  const pcmBody = (samples: number[], chunkBytes = 3) => {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    samples.forEach((s, i) => view.setInt16(i * 2, s, true));
    return new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += chunkBytes) c.enqueue(bytes.slice(i, i + chunkBytes));
        c.close();
      },
    });
  };
  const pcmResponse = (samples: number[], chunkBytes?: number) =>
    new HttpResponse(pcmBody(samples, chunkBytes), {
      headers: { "content-type": "application/octet-stream", "X-Sr": "24000", "X-Sf": "s16le", "X-Ch": "1" },
    });

  const collect = async (args: Partial<Parameters<typeof streamSpeech>[0]> = {}) => {
    const chunks: AudioChunk[] = [];
    await streamSpeech({ text: "Hello.", onChunk: (c) => chunks.push(c), ...args });
    return chunks;
  };

  it("asks for a stream and decodes PCM as it arrives", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(TTS, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return pcmResponse([0, 16384, -32768, 8192], 3);
      }),
    );
    const chunks = await collect({ speakerKey: "Ann", groupId: "g1", announce: false });

    expect(body).toEqual({
      token: "voice-token",
      text: "Hello.",
      speaker_key: "Ann",
      group_id: "g1",
      announce: false,
      stream: true,
    });
    // Several chunks, split mid-sample on the wire, still add up exactly.
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.sampleRate === 24_000)).toBe(true);
    expect(chunks.flatMap((c) => Array.from(c.channels[0]))).toEqual([0, 0.5, -1, 0.25]);
  });

  it("announces by default and omits a blank speaker", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(TTS, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return pcmResponse([1]);
      }),
    );
    await collect({ speakerKey: "" });
    expect(body).toMatchObject({ announce: true, stream: true });
    expect(body).not.toHaveProperty("speaker_key");
  });

  it("falls back to a complete WAV when the server can't stream", async () => {
    const wav = new Uint8Array(46);
    const view = new DataView(wav.buffer);
    [..."RIFF"].forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
    view.setUint32(4, 38, true);
    [..."WAVEfmt "].forEach((c, i) => view.setUint8(8 + i, c.charCodeAt(0)));
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16_000, true);
    view.setUint16(34, 16, true);
    [..."data"].forEach((c, i) => view.setUint8(36 + i, c.charCodeAt(0)));
    view.setUint32(40, 2, true);
    view.setInt16(44, 16384, true);
    server.use(
      http.post(TTS, () => new HttpResponse(wav, { headers: { "content-type": "audio/wav" } })),
    );
    const chunks = await collect();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sampleRate).toBe(16_000);
    expect(chunks[0].channels[0][0]).toBe(0.5);
  });

  it("throws the backend message without toasting", async () => {
    server.use(http.post(TTS, () => envelopeError(502, "Text to speech failed")));
    await expect(collect()).rejects.toThrow("Text to speech failed");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rejects a stream with no audio in it", async () => {
    server.use(http.post(TTS, () => pcmResponse([])));
    await expect(collect()).rejects.toThrow(/couldn't play/i);
  });

  it("rejects an unknown sample format", async () => {
    server.use(
      http.post(TTS, () =>
        new HttpResponse(pcmBody([1]), {
          headers: { "content-type": "application/octet-stream", "X-Sf": "f32le" },
        }),
      ),
    );
    await expect(collect()).rejects.toThrow(/unsupported audio format/i);
  });

  it("rejects with an AbortError when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(collect({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports a network failure", async () => {
    server.use(http.post(TTS, () => HttpResponse.error()));
    await expect(collect()).rejects.toThrow(/network/i);
  });
});
