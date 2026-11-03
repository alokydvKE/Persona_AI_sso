import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SpeechPlayer,
  type AudioOutput,
  type PlayableBuffer,
  type PlayableSource,
} from "@/lib/voice/speechPlayer";
import type { SpeechStreamArgs } from "@/api/Voice/voice";
import type { AudioChunk } from "@/lib/voice/pcm";

/**
 * A Web Audio stand-in with a hand-driven clock: `advance(s)` moves time on and
 * fires `onended` for every source whose audio has finished by then.
 */
class FakeOutput implements AudioOutput {
  currentTime = 0;
  state = "running";
  destination = {};
  resume = vi.fn(async () => {
    if (this.resumable) this.state = "running";
  });
  resumable = true;
  sources: FakeSource[] = [];

  createBuffer(_channels: number, length: number, sampleRate: number): PlayableBuffer {
    return { duration: length / sampleRate, copyToChannel: vi.fn() };
  }

  createBufferSource(): PlayableSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  /** Real (non-silent) sources in start order: [start, duration]. */
  get timeline(): [number, number][] {
    return this.sources
      .filter((s) => s.startedAt !== null && (s.buffer?.duration ?? 0) > 0.01)
      .map((s) => [round(s.startedAt!), round(s.buffer!.duration)]);
  }

  advance(seconds: number) {
    this.currentTime += seconds;
    for (const s of this.sources) {
      if (s.startedAt === null || s.ended || s.stopped) continue;
      if (s.startedAt + (s.buffer?.duration ?? 0) <= this.currentTime) {
        s.ended = true;
        s.onended?.();
      }
    }
  }
}

class FakeSource implements PlayableSource {
  buffer: PlayableBuffer | null = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  ended = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start(when: number) {
    this.startedAt = when;
  }
  stop() {
    this.stopped = true;
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** `seconds` of mono audio at 1 kHz (so frame counts stay small). */
const audio = (seconds: number): AudioChunk => ({
  sampleRate: 1000,
  channels: [new Float32Array(Math.round(seconds * 1000))],
});

type Call = SpeechStreamArgs & {
  push: (seconds: number) => void;
  finish: () => void;
  fail: (error: Error) => void;
};

function setup() {
  const out = new FakeOutput();
  const calls: Call[] = [];
  const synthesize = vi.fn(
    (args: SpeechStreamArgs) =>
      new Promise<void>((resolve, reject) => {
        const call: Call = {
          ...args,
          push: (seconds) => args.onChunk(audio(seconds)),
          finish: resolve,
          fail: reject,
        };
        args.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
        calls.push(call);
      }),
  );
  const onError = vi.fn();
  const createOutput = vi.fn(() => out);
  const player = new SpeechPlayer({ synthesize, createOutput, onError });
  return { player, out, calls, synthesize, onError, createOutput };
}

/** Let promise continuations (fetch results, loop steps) run. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useRealTimers();
});

describe("SpeechPlayer — streaming a reply as it is written", () => {
  it("starts speaking after the first sentence, before the reply is finished", async () => {
    const { player, out, calls } = setup();
    player.open({ id: "m1", speakerKey: "Ann", groupId: "g1" });
    player.append("m1", "Hello there");
    await flush();
    expect(calls).toHaveLength(0); // no whole sentence yet

    player.append("m1", ". I think it");
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ text: "Hello there.", speakerKey: "Ann", groupId: "g1", announce: true });

    calls[0].push(0.5);
    await flush();
    // Audio is scheduled while the persona is still "typing".
    expect(out.timeline).toEqual([[0.05, 0.5]]);
    expect(player.statusOf("m1")).toBe("playing");
  });

  it("announces the speaker on the first piece only", async () => {
    const { player, calls } = setup();
    player.open({ id: "m1", speakerKey: "Ann" });
    player.append("m1", "First one. ");
    player.append("m1", "Then a second sentence that is long enough to be its own piece of speech. ");
    player.end("m1");
    await flush();
    expect(calls.map((c) => [c.text, c.announce])).toEqual([
      ["First one.", true],
      ["Then a second sentence that is long enough to be its own piece of speech.", false],
    ]);
  });

  it("plays pieces back to back as their audio streams in", async () => {
    const { player, out, calls } = setup();
    player.enqueue({
      id: "m1",
      text: "One. Two is a longer sentence that has plenty of words in it to stand alone here.",
    });
    await flush();
    calls[0].push(0.3);
    calls[0].push(0.2);
    calls[1].push(1);
    calls[0].finish();
    calls[1].finish();
    await flush();
    // Chunks of a piece, then the next piece, with no gaps.
    expect(out.timeline).toEqual([
      [0.05, 0.3],
      [0.35, 0.2],
      [0.55, 1],
    ]);
  });

  it("speaks personas one at a time, in order, with a breath between them", async () => {
    const { player, out, calls } = setup();
    player.open({ id: "a", speakerKey: "Ann" });
    player.open({ id: "b", speakerKey: "Bob" });
    player.append("b", "Bob talks first on the wire. ");
    player.append("a", "Ann was opened first. ");
    await flush();
    // Both are fetched ahead...
    expect(calls.map((c) => c.speakerKey).sort()).toEqual(["Ann", "Bob"]);
    const bob = calls.find((c) => c.speakerKey === "Bob")!;
    const ann = calls.find((c) => c.speakerKey === "Ann")!;
    bob.push(1);
    bob.finish();
    await flush();
    // ...but Bob waits for Ann, who hasn't ended.
    expect(out.timeline).toEqual([]);

    ann.push(1);
    ann.finish();
    player.end("a");
    player.end("b");
    await flush();
    expect(out.timeline).toEqual([
      [0.05, 1],
      [1.4, 1], // 0.35s gap after Ann's audio ends at 1.05
    ]);
  });

  it("fetches at most two pieces at once", async () => {
    const { player, calls } = setup();
    for (const id of ["a", "b", "c", "d"]) player.enqueue({ id, text: `Reply ${id}.` });
    await flush();
    expect(calls).toHaveLength(2);
    calls[0].push(0.1);
    calls[0].finish();
    await flush();
    expect(calls).toHaveLength(3);
  });

  it("skips speechless pieces without using up the announcement", async () => {
    const { player, calls } = setup();
    player.open({ id: "m1", speakerKey: "Ann" });
    player.append("m1", "---\n");
    player.append("m1", "Real words here.\n");
    player.end("m1");
    await flush();
    expect(calls.map((c) => [c.text, c.announce])).toEqual([["Real words here.", true]]);
  });

  it("ignores text for unknown or ended utterances", async () => {
    const { player, calls } = setup();
    player.append("nope", "Hello.");
    player.open({ id: "m1" });
    player.end("m1");
    player.end("m1");
    player.append("m1", "Too late.");
    await flush();
    expect(calls).toHaveLength(0);
  });
});

describe("SpeechPlayer — status", () => {
  it("is loading while waiting, playing while audible, idle when done", async () => {
    const { player, out, calls } = setup();
    player.open({ id: "m1" });
    expect(player.statusOf("m1")).toBe("loading");

    player.append("m1", "Hello.");
    player.end("m1");
    await flush();
    calls[0].push(0.5);
    calls[0].finish();
    await flush();
    expect(player.statusOf("m1")).toBe("playing");

    out.advance(1);
    await flush();
    expect(player.statusOf("m1")).toBe("idle");
  });

  it("moves the playing status from one persona to the next", async () => {
    const { player, out, calls } = setup();
    player.enqueue({ id: "a", text: "A speaks." });
    player.enqueue({ id: "b", text: "B speaks." });
    await flush();
    calls[0].push(0.5);
    calls[1].push(0.5);
    calls[0].finish();
    calls[1].finish();
    await flush();
    expect(player.statusOf("a")).toBe("playing");
    out.advance(0.6);
    expect(player.statusOf("b")).toBe("playing");
    expect(player.statusOf("a")).toBe("idle");
  });

  it("notifies subscribers", async () => {
    const { player } = setup();
    const listener = vi.fn();
    const unsubscribe = player.subscribe(listener);
    player.open({ id: "m1" });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    player.stop();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("SpeechPlayer — cancelling", () => {
  it("stop silences audio, aborts requests and reports nothing", async () => {
    const { player, out, calls, onError } = setup();
    player.enqueue({ id: "a", text: "First reply." });
    player.enqueue({ id: "b", text: "Second reply." });
    await flush();
    calls[0].push(1);
    await flush();

    player.stop();
    await flush();
    expect(out.sources.every((s) => s.stopped)).toBe(true);
    expect(calls.every((c) => c.signal?.aborted)).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(player.statusOf("a")).toBe("idle");
  });

  it("works again after a stop", async () => {
    const { player, calls, out } = setup();
    player.enqueue({ id: "a", text: "Before." });
    await flush();
    player.stop();
    player.enqueue({ id: "b", text: "After." });
    await flush();
    const after = calls.find((c) => c.text === "After.")!;
    after.push(0.2);
    after.finish();
    await flush();
    expect(out.timeline).toEqual([[0.05, 0.2]]);
  });

  it("discard drops one reply mid-play and moves on to the next", async () => {
    const { player, out, calls, onError } = setup();
    player.open({ id: "a" });
    player.append("a", "Cut off mid ");
    player.append("a", "sentence. ");
    player.enqueue({ id: "b", text: "Next persona." });
    await flush();
    calls[0].push(0.5);
    await flush();

    player.discard("a");
    await flush();
    expect(out.sources[0].stopped).toBe(true);
    expect(calls[0].signal?.aborted).toBe(true);

    calls[1].push(0.5);
    calls[1].finish();
    await flush();
    expect(out.timeline.at(-1)?.[1]).toBe(0.5);
    expect(player.statusOf("b")).toBe("playing");
    expect(onError).not.toHaveBeenCalled();
  });

  it("toggle stops the message being read, or plays another one", async () => {
    const { player, calls } = setup();
    player.toggle({ id: "a", text: "Hello." });
    await flush();
    calls[0].push(0.5);
    await flush();
    expect(player.statusOf("a")).toBe("playing");

    player.toggle({ id: "a", text: "Hello." });
    expect(player.statusOf("a")).toBe("idle");

    player.toggle({ id: "b", text: "Other." });
    expect(player.statusOf("b")).toBe("loading");
  });
});

describe("SpeechPlayer — failures", () => {
  it("reports a failed piece and keeps reading the rest", async () => {
    const { player, out, calls, onError } = setup();
    player.enqueue({ id: "a", text: "Broken." });
    player.enqueue({ id: "b", text: "Fine." });
    await flush();
    calls[0].fail(new Error("Text to speech failed"));
    calls[1].push(0.4);
    calls[1].finish();
    await flush();
    expect(onError).toHaveBeenCalledWith("Text to speech failed");
    expect(out.timeline).toEqual([[0.05, 0.4]]);
  });

  it("stops and notifies when the browser keeps audio suspended", async () => {
    vi.useFakeTimers();
    const { player, out, calls, onError } = setup();
    out.state = "suspended";
    out.resumable = false;
    const blocked = vi.fn();
    player.onAutoplayBlocked(blocked);

    player.enqueue({ id: "a", text: "Hello." });
    await vi.advanceTimersByTimeAsync(0);
    calls[0].push(0.5);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/blocked audio/i));
    expect(blocked).toHaveBeenCalled();
    expect(player.statusOf("a")).toBe("idle");
  });

  it("resumes a suspended output before scheduling", async () => {
    const { player, out, calls } = setup();
    out.state = "suspended";
    player.enqueue({ id: "a", text: "Hello." });
    await flush();
    calls[0].push(0.5);
    await flush();
    expect(out.resume).toHaveBeenCalled();
    expect(out.timeline).toHaveLength(1);
  });

  it("reports when the browser has no Web Audio", async () => {
    const { player, calls, onError, createOutput } = setup();
    createOutput.mockReturnValue(null as unknown as FakeOutput);
    player.enqueue({ id: "a", text: "Hello." });
    await flush();
    calls[0].push(0.5);
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/can't play/i));
  });
});

describe("SpeechPlayer — replay and priming", () => {
  it("replays a message from cache without synthesizing again", async () => {
    const { player, out, calls, synthesize } = setup();
    player.enqueue({ id: "a", text: "Cache me.", speakerKey: "Ann", groupId: "g1" });
    await flush();
    calls[0].push(0.5);
    calls[0].finish();
    await flush();
    out.advance(1);

    player.toggle({ id: "a2", text: "Cache me.", speakerKey: "Ann", groupId: "g1" });
    await flush();
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(player.statusOf("a2")).toBe("playing");
  });

  it("does not share cached audio across groups", async () => {
    const { player, calls, synthesize } = setup();
    player.enqueue({ id: "a", text: "Same text.", speakerKey: "Ann", groupId: "g1" });
    await flush();
    calls[0].push(0.2);
    calls[0].finish();
    await flush();
    player.stop();
    player.enqueue({ id: "b", text: "Same text.", speakerKey: "Ann", groupId: "g2" });
    await flush();
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it("prime resumes the output and starts a silent sound", () => {
    const { player, out } = setup();
    out.state = "suspended";
    player.prime();
    expect(out.resume).toHaveBeenCalled();
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0].startedAt).toBe(0);
    expect(player.statusOf("anything")).toBe("idle");
  });

  it("prime tolerates a rejected resume", async () => {
    const { player, out } = setup();
    out.resume.mockRejectedValueOnce(new Error("nope"));
    expect(() => player.prime()).not.toThrow();
    await flush();
  });
});
