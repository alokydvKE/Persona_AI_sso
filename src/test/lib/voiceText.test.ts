import { describe, it, expect } from "vitest";
import {
  MAX_PIECE_CHARS,
  MIN_PIECE_CHARS,
  isSpeakable,
  takeSpeakablePieces,
} from "@/lib/voice/sentences";
import { createPcm16Decoder, parseWav } from "@/lib/voice/pcm";

/** Feed `text` in `size`-char deltas, the way a stream would. */
function stream(text: string, size: number): string[] {
  const out: string[] = [];
  let buffer = "";
  let first = true;
  for (let i = 0; i < text.length; i += size) {
    buffer += text.slice(i, i + size);
    const { pieces, rest } = takeSpeakablePieces(buffer, { first, final: false });
    buffer = rest;
    if (pieces.length) first = false;
    out.push(...pieces);
  }
  out.push(...takeSpeakablePieces(buffer, { first, final: true }).pieces);
  return out;
}

describe("takeSpeakablePieces", () => {
  it("waits for a complete sentence", () => {
    expect(takeSpeakablePieces("Hello there", { first: true, final: false })).toEqual({
      pieces: [],
      rest: "Hello there",
    });
    // A period needs following whitespace: more of the sentence may be coming.
    expect(takeSpeakablePieces("It costs 3.", { first: true, final: false }).pieces).toEqual([]);
  });

  it("releases the first sentence immediately, however short", () => {
    const { pieces, rest } = takeSpeakablePieces("Yes. And then", { first: true, final: false });
    expect(pieces).toEqual(["Yes."]);
    expect(rest).toBe(" And then");
  });

  it("batches later sentences up to the minimum length", () => {
    const short = "Short one. ";
    expect(takeSpeakablePieces(short, { first: false, final: false }).pieces).toEqual([]);
    const enough = short.repeat(Math.ceil(MIN_PIECE_CHARS / short.length) + 1);
    const { pieces } = takeSpeakablePieces(enough, { first: false, final: false });
    expect(pieces).toHaveLength(1);
    expect(pieces[0].length).toBeGreaterThanOrEqual(MIN_PIECE_CHARS);
  });

  it("does not split on abbreviations, initials or decimals", () => {
    const text = "Dr. Smith and J. Doe paid 3.5 dollars, e.g. on sale. Next";
    expect(takeSpeakablePieces(text, { first: true, final: false }).pieces).toEqual([
      "Dr. Smith and J. Doe paid 3.5 dollars, e.g. on sale.",
    ]);
  });

  it("treats line breaks and closing quotes as sentence ends", () => {
    expect(takeSpeakablePieces("- first item\n- second", { first: true, final: false }).pieces)
      .toEqual(["- first item"]);
    expect(takeSpeakablePieces('She said "wow!" Then', { first: true, final: false }).pieces)
      .toEqual(['She said "wow!"']);
  });

  it("cuts a run-on sentence at a word boundary once it gets long", () => {
    const runOn = "word ".repeat(100);
    const { pieces, rest } = takeSpeakablePieces(runOn, { first: true, final: false });
    expect(pieces.length).toBeGreaterThan(0);
    pieces.forEach((p) => {
      expect(p.length).toBeLessThanOrEqual(MAX_PIECE_CHARS);
      expect(p.endsWith("word")).toBe(true); // never mid-word
    });
    expect(rest.length).toBeLessThanOrEqual(MAX_PIECE_CHARS);
  });

  it("releases the remainder when final", () => {
    expect(takeSpeakablePieces("  trailing words  ", { first: false, final: true })).toEqual({
      pieces: ["trailing words"],
      rest: "",
    });
  });

  it("loses and duplicates nothing however the text is chunked", () => {
    const text =
      "Hi! I'd rate it 7/10. The taste is good, e.g. the citrus, but Mr. Price is high.\n" +
      "- Pro: clean label\n- Con: cost\nOverall? Worth a try… maybe.";
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const size of [1, 3, 7, 50, text.length]) {
      expect(normalize(stream(text, size).join(" "))).toBe(normalize(text));
    }
  });
});

describe("isSpeakable", () => {
  it("rejects pieces with nothing to say", () => {
    expect(isSpeakable("---")).toBe(false);
    expect(isSpeakable("**")).toBe(false);
    expect(isSpeakable("7")).toBe(true);
    expect(isSpeakable("Oui.")).toBe(true);
  });
});

const le16 = (...samples: number[]) => {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((s, i) => view.setInt16(i * 2, s, true));
  return bytes;
};

describe("createPcm16Decoder", () => {
  it("decodes s16le to floats", () => {
    const chunk = createPcm16Decoder(24_000, 1).push(le16(0, 16384, -32768));
    expect(chunk?.sampleRate).toBe(24_000);
    expect(Array.from(chunk!.channels[0])).toEqual([0, 0.5, -1]);
  });

  it("carries a sample split across network chunks", () => {
    const decoder = createPcm16Decoder(24_000, 1);
    const bytes = le16(100, 200, 300);
    expect(decoder.push(bytes.slice(0, 3))?.channels[0].length).toBe(1);
    expect(decoder.pendingBytes).toBe(1);
    const rest = decoder.push(bytes.slice(3));
    expect(Array.from(rest!.channels[0]).map((v) => Math.round(v * 0x8000))).toEqual([200, 300]);
  });

  it("returns null until a whole frame arrives and deinterleaves channels", () => {
    const decoder = createPcm16Decoder(8_000, 2);
    expect(decoder.push(le16(1))).toBeNull();
    const chunk = decoder.push(le16(2, 3, 4));
    expect(chunk!.channels).toHaveLength(2);
    expect(Array.from(chunk!.channels[0]).map((v) => v * 0x8000)).toEqual([1, 3]);
    expect(Array.from(chunk!.channels[1]).map((v) => v * 0x8000)).toEqual([2, 4]);
  });

  it("rejects nonsense headers", () => {
    expect(() => createPcm16Decoder(NaN, 1)).toThrow();
    expect(() => createPcm16Decoder(24_000, 0)).toThrow();
  });
});

function wav(samples: number[], { sampleRate = 16_000, extraChunk = false } = {}): ArrayBuffer {
  const data = le16(...samples);
  const extra = extraChunk ? 8 + 4 : 0;
  const buffer = new ArrayBuffer(44 + extra + data.length);
  const view = new DataView(buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  let o = 36;
  if (extraChunk) {
    tag(o, "LIST");
    view.setUint32(o + 4, 4, true);
    o += 12;
  }
  tag(o, "data");
  view.setUint32(o + 4, data.length, true);
  new Uint8Array(buffer, o + 8).set(data);
  return buffer;
}

describe("parseWav", () => {
  it("decodes a PCM WAV", () => {
    const chunk = parseWav(wav([0, 16384]));
    expect(chunk.sampleRate).toBe(16_000);
    expect(Array.from(chunk.channels[0])).toEqual([0, 0.5]);
  });

  it("skips extra chunks before the audio", () => {
    expect(parseWav(wav([16384], { extraChunk: true })).channels[0][0]).toBe(0.5);
  });

  it("rejects what isn't a PCM WAV", () => {
    expect(() => parseWav(new TextEncoder().encode("not audio at all").buffer)).toThrow(/not a wav/i);
  });
});
