/**
 * Raw audio helpers for streamed speech.
 *
 * The backend's streamed /render body is headerless PCM (16-bit little-endian,
 * interleaved channels) described only by the X-Sr / X-Sf / X-Ch response
 * headers; its buffered fallback is a plain PCM WAV file. Both end up as
 * `AudioChunk`s: planar float samples ready for an AudioBuffer.
 */

export type AudioChunk = {
  sampleRate: number;
  /** One Float32Array per channel, all the same length. */
  channels: Float32Array[];
};

/** Samples in a chunk (per channel). */
export const chunkFrames = (chunk: AudioChunk): number => chunk.channels[0]?.length ?? 0;

/**
 * Decoder for a headerless s16le stream that arrives in arbitrary pieces.
 *
 * Network chunks don't respect sample (or frame) boundaries, so the bytes of a
 * frame split across two reads are carried over to the next `push` instead of
 * being misread as two half-samples.
 */
export function createPcm16Decoder(sampleRate: number, channelCount: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid sample rate: ${sampleRate}`);
  }
  if (!Number.isInteger(channelCount) || channelCount < 1) {
    throw new Error(`Invalid channel count: ${channelCount}`);
  }
  const frameBytes = 2 * channelCount;
  let carry = new Uint8Array(0);

  return {
    /** Decode every whole frame received so far; null when none is complete yet. */
    push(bytes: Uint8Array): AudioChunk | null {
      let data = bytes;
      if (carry.length > 0) {
        data = new Uint8Array(carry.length + bytes.length);
        data.set(carry);
        data.set(bytes, carry.length);
      }
      const frames = Math.floor(data.length / frameBytes);
      const used = frames * frameBytes;
      carry = data.slice(used);
      if (frames === 0) return null;
      return {
        sampleRate,
        channels: deinterleave(new DataView(data.buffer, data.byteOffset, used), frames, channelCount),
      };
    },
    /** Bytes left over that never formed a whole frame (dropped at end of stream). */
    get pendingBytes() {
      return carry.length;
    },
  };
}

function deinterleave(view: DataView, frames: number, channelCount: number): Float32Array[] {
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < channelCount; ch++) {
      channels[ch][frame] = view.getInt16((frame * channelCount + ch) * 2, true) / 0x8000;
    }
  }
  return channels;
}

/**
 * Decode a 16-bit PCM WAV file (the backend's non-streamed response).
 * Walks the RIFF chunks rather than assuming a 44-byte header, since encoders
 * may add chunks (LIST, fact…) before `data`.
 */
export function parseWav(buffer: ArrayBuffer): AudioChunk {
  const view = new DataView(buffer);
  const tag = (offset: number) =>
    String.fromCharCode(...new Uint8Array(buffer, offset, 4));
  if (buffer.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new Error("Not a WAV file");
  }

  let sampleRate = 0;
  let channelCount = 0;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      const format = view.getUint16(body, true);
      const bits = view.getUint16(body + 14, true);
      if (format !== 1 || bits !== 16) {
        throw new Error("Unsupported WAV encoding (expected 16-bit PCM)");
      }
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
    } else if (id === "data") {
      if (!sampleRate || !channelCount) throw new Error("WAV data before its format");
      // A streaming encoder may leave the size unset/oversized; clamp to the file.
      const end = Math.min(body + size, buffer.byteLength);
      const decoder = createPcm16Decoder(sampleRate, channelCount);
      const chunk = decoder.push(new Uint8Array(buffer, body, end - body));
      return chunk ?? { sampleRate, channels: Array.from({ length: channelCount }, () => new Float32Array(0)) };
    }
    // Chunks are word-aligned: an odd size is followed by a pad byte.
    offset = body + size + (size % 2);
  }
  throw new Error("WAV file has no audio data");
}
