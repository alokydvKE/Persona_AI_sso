import { describe, it, expect } from "vitest";
import {
  replyThinkingPhrases,
  UPLOAD_THINKING,
} from "../../../../components/common/Chat/GroupChat/groupChatThinking";

const everyone = { personaName: null, withImages: false, withAssumptions: false };

describe("replyThinkingPhrases", () => {
  it("walks through the turn for everyone, ending on a line that can stay up", () => {
    const lines = replyThinkingPhrases(everyone);
    expect(lines[0]).toBe("Reading your question…");
    expect(lines).toContain("Each persona is thinking it over…");
    expect(lines).toContain("Comparing points of view…");
    expect(lines.at(-1)).toBe("Almost ready…");
  });

  it("only mentions images when the turn had some", () => {
    expect(replyThinkingPhrases(everyone).join(" ")).not.toMatch(/image/i);
    const withImages = replyThinkingPhrases({ ...everyone, withImages: true });
    expect(withImages).toContain("Showing your images to the personas…");
    expect(withImages).toContain("Looking at what's in your images…");
  });

  it("only mentions assumptions when the chat has some", () => {
    expect(replyThinkingPhrases(everyone)).not.toContain("Keeping your assumptions in mind…");
    expect(
      replyThinkingPhrases({ ...everyone, withAssumptions: true }),
    ).toContain("Keeping your assumptions in mind…");
  });

  it("speaks of one persona by name", () => {
    const lines = replyThinkingPhrases({ ...everyone, personaName: "Alpha", withImages: true });
    expect(lines).toContain("Sharing it with Alpha…");
    expect(lines).toContain("Showing your images to Alpha…");
    expect(lines).toContain("Pulling up Alpha's survey answers…");
    expect(lines).toContain("Alpha is thinking it over…");
    expect(lines).toContain("Reply on the way…");
    // Nothing to compare, and no talk of "personas".
    expect(lines).not.toContain("Comparing points of view…");
    expect(lines.join(" ")).not.toMatch(/personas/);
  });

  it("writes the possessive of a name ending in s properly", () => {
    expect(
      replyThinkingPhrases({ ...everyone, personaName: "Snack Optimizers" }),
    ).toContain("Pulling up Snack Optimizers' survey answers…");
  });

  it("treats a blank name as everyone", () => {
    expect(replyThinkingPhrases({ ...everyone, personaName: "  " })).toEqual(
      replyThinkingPhrases(everyone),
    );
  });
});

describe("UPLOAD_THINKING", () => {
  it("starts with the upload itself", () => {
    expect(UPLOAD_THINKING[0]).toBe("Uploading your images…");
  });
});
