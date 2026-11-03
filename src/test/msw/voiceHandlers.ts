import { http, HttpResponse } from "msw";
import { API_URL, ok } from "./handlers";
import { VOICE_ENDPOINTS } from "@/api/Voice/endpoints";

const url = (path: string) => `${API_URL}${path}`;

/** 44-byte WAV header with no samples — a valid, silent clip. */
export function silentWav(): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 48000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, 0, true);
  return buffer;
}

export function wavResponse() {
  return new HttpResponse(silentWav(), {
    headers: { "content-type": "audio/wav" },
  });
}

/** Voice defaults: both features on, transcription and synthesis succeed. */
export const voiceHandlers = [
  http.post(url(VOICE_ENDPOINTS.config), () =>
    ok({
      stt: { enabled: true },
      tts: { enabled: true },
      limits: { max_recording_seconds: 30 },
    }),
  ),
  http.post(url(VOICE_ENDPOINTS.stt), () =>
    ok({ text: "hello from the mic", duration_seconds: 1.2, latency_ms: 300 }),
  ),
  http.post(url(VOICE_ENDPOINTS.tts), () => wavResponse()),
];
