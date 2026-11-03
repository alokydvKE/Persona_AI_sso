/**
 * Status lines shown while a group-chat turn waits for its first reply. They
 * follow what actually happens before replies start: images are looked at, the
 * question is checked against the personas, each persona's survey evidence is
 * pulled (with the chat's assumptions applied), then the personas write.
 *
 * Shown in order, one every couple of seconds; the last stays up for however
 * long the wait lasts (see LoadingMessage).
 */

/** While the turn's images upload, before the question is sent. */
export const UPLOAD_THINKING = ["Uploading your images…", "Getting your images ready…"] as const;

export type ThinkingTurn = {
  /** The one persona addressed, or null when messaging everyone. */
  personaName: string | null;
  /** Images went with this turn. */
  withImages: boolean;
  /** The chat has assumptions applied, so replies take them into account. */
  withAssumptions: boolean;
};

/** "Snack Optimizers'" / "Alpha's". */
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

export function replyThinkingPhrases({
  personaName,
  withImages,
  withAssumptions,
}: ThinkingTurn): string[] {
  const one = personaName?.trim() || null;
  return [
    "Reading your question…",
    one ? `Sharing it with ${one}…` : "Sharing it with the personas…",
    ...(withImages
      ? [
          one ? `Showing your images to ${one}…` : "Showing your images to the personas…",
          "Looking at what's in your images…",
        ]
      : []),
    one ? `Checking it fits ${one}…` : "Checking it fits these personas…",
    one ? `Pulling up ${possessive(one)} survey answers…` : "Pulling up each persona's survey answers…",
    "Finding the most relevant evidence…",
    "Checking what respondents actually said…",
    ...(withAssumptions ? ["Keeping your assumptions in mind…"] : []),
    one ? `${one} is thinking it over…` : "Each persona is thinking it over…",
    "Weighing their own experiences…",
    // Nothing to compare with a single persona.
    ...(one ? [] : ["Comparing points of view…"]),
    "Gathering their thoughts…",
    "Putting thoughts into words…",
    one ? "Reply on the way…" : "First replies on the way…",
    "Almost ready…",
  ];
}
