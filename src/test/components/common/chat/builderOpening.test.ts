import { describe, it, expect } from "vitest";
import {
  openingMessageId,
  readBuilderOpening,
} from "../../../../components/common/Chat/builderOpening";

describe("readBuilderOpening", () => {
  const opening = { conversationId: "c1", message: "Hi! What shall we build?" };

  it("returns the opening handed over for this chat", () => {
    expect(readBuilderOpening({ projectId: "p1", opening }, "c1")).toEqual(opening);
  });

  it("ignores an opening meant for another chat", () => {
    expect(readBuilderOpening({ opening }, "c2")).toBeNull();
  });

  it.each([
    ["no state", null],
    ["a string state", "opening"],
    ["no opening", { projectId: "p1" }],
    ["a non-object opening", { opening: "hi" }],
    ["a blank message", { opening: { conversationId: "c1", message: "   " } }],
    ["a non-string message", { opening: { conversationId: "c1", message: 42 } }],
  ])("ignores %s", (_, state) => {
    expect(readBuilderOpening(state, "c1")).toBeNull();
  });

  it("needs a chat to match against", () => {
    expect(readBuilderOpening({ opening }, undefined)).toBeNull();
  });

  it("keeps the message exactly as sent", () => {
    const padded = { conversationId: "c1", message: "  Hi!\n" };
    expect(readBuilderOpening({ opening: padded }, "c1")?.message).toBe("  Hi!\n");
  });
});

describe("openingMessageId", () => {
  it("matches the id the history gives the opening reply", () => {
    expect(openingMessageId("c1")).toBe("c1-h-0-a");
  });
});
