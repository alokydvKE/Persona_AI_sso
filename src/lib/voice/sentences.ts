/**
 * Cuts a reply that is still streaming into pieces worth sending to TTS.
 *
 * Speech can only start once there is a whole sentence (a TTS voice reads a
 * fragment with the wrong intonation), but waiting for the whole reply is what
 * makes read-aloud feel slow. So text is released sentence by sentence:
 *
 * - the FIRST piece of a reply goes out as soon as one sentence is complete —
 *   it decides how soon the persona starts talking;
 * - later pieces gather sentences up to ~MIN_PIECE_CHARS, which halves the
 *   request count and gives the voice longer runs to phrase naturally, while
 *   the first piece is still being spoken;
 * - a run-on with no sentence end is cut at a clause/word boundary once it gets
 *   long, so one endless sentence can't stall speech.
 */

/** Later pieces are batched to at least this many characters. */
export const MIN_PIECE_CHARS = 80;
/** Past this, a piece is cut even without a sentence end. */
export const MAX_PIECE_CHARS = 280;

// Words whose trailing period is not a sentence end.
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e",
  "eg", "ie", "approx", "no", "fig", "inc", "ltd", "co", "dept", "est", "min", "max",
]);

/**
 * Index just past each sentence end in `text`: `.`/`!`/`?`/`…` (plus any
 * closing quotes/brackets) followed by whitespace, or a line break (list items
 * and paragraphs are separate utterances). A period after an abbreviation, an
 * initial ("J.") or inside a number ("3.5") doesn't count.
 */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const re = /([.!?…]+)(["'”’)\]]*)(?=\s)|\n+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (m[0].startsWith("\n")) {
      ends.push(end);
      continue;
    }
    if (m[1] === ".") {
      const word = /([\p{L}.]+)$/u.exec(text.slice(0, m.index))?.[1] ?? "";
      const bare = word.toLowerCase().replace(/\.$/, "");
      if (ABBREVIATIONS.has(bare) || /^\p{Lu}$/u.test(word)) continue;
    }
    ends.push(end);
  }
  return ends;
}

/** Last clause/word boundary at or before `limit`, for cutting a run-on. */
function softBreak(text: string, limit: number): number {
  const head = text.slice(0, limit);
  const clause = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "));
  if (clause > limit / 2) return clause + 2;
  const space = head.lastIndexOf(" ");
  return space > 0 ? space + 1 : limit;
}

/** True when a piece has something a voice can say (not just markdown/punctuation). */
export const isSpeakable = (piece: string): boolean => /[\p{L}\p{N}]/u.test(piece);

/**
 * Split off the pieces of `buffer` that are ready to speak.
 *
 * @param buffer  Text received but not yet released.
 * @param first   True while no piece of this reply has been released yet.
 * @param final   The reply is complete: release everything that is left.
 * @returns The pieces to speak now (trimmed, never empty) and the remainder.
 */
export function takeSpeakablePieces(
  buffer: string,
  { first, final }: { first: boolean; final: boolean },
): { pieces: string[]; rest: string } {
  const pieces: string[] = [];
  let rest = buffer;
  let isFirst = first;

  const release = (cut: number) => {
    const piece = rest.slice(0, cut).trim();
    rest = rest.slice(cut);
    if (piece) {
      pieces.push(piece);
      isFirst = false;
    }
  };

  for (;;) {
    const ends = sentenceEnds(rest);
    const min = isFirst ? 1 : MIN_PIECE_CHARS;
    // Smallest run of whole sentences that reaches the minimum length.
    const cut = ends.find((end) => rest.slice(0, end).trim().length >= min);
    if (cut !== undefined && cut <= MAX_PIECE_CHARS) {
      release(cut);
      continue;
    }
    if (rest.length > MAX_PIECE_CHARS) {
      // Too long to keep waiting: prefer the last sentence end in range.
      const inRange = ends.filter((end) => end <= MAX_PIECE_CHARS);
      release(inRange.length > 0 ? inRange[inRange.length - 1] : softBreak(rest, MAX_PIECE_CHARS));
      continue;
    }
    break;
  }

  if (final) release(rest.length);
  return { pieces, rest };
}
