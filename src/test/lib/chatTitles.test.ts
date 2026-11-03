import { describe, it, expect } from "vitest";
import { groupChatTitle } from "@/lib/chatTitles";

describe("groupChatTitle", () => {
  it("is the persona's own name for a one-persona chat", () => {
    expect(groupChatTitle(["Curious Everyday Snack Optimizers"])).toBe(
      "Curious Everyday Snack Optimizers",
    );
  });

  it("names the first persona and counts the rest", () => {
    expect(
      groupChatTitle([
        "Ingredient-Savvy Snack Explorers",
        "Time-Pressed Meal Solution Optimizers",
        "Household-Fit Milk Navigators",
      ]),
    ).toBe("Ingredient-Savvy Snack Explorers + 2 more");
  });

  it("skips blank names", () => {
    expect(groupChatTitle(["  ", null, "Alpha", undefined, "Beta"])).toBe("Alpha + 1 more");
  });

  it("falls back when there are no names at all", () => {
    expect(groupChatTitle([])).toBe("Group chat");
    expect(groupChatTitle(["", "  "])).toBe("Group chat");
  });
});
