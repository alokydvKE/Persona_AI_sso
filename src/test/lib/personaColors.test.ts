import { describe, it, expect } from "vitest";
import { personaColorStyle, personaInitials } from "../../lib/personaColors";

describe("personaColorStyle", () => {
  it("returns the matching palette for a known color", () => {
    expect(personaColorStyle("green")).toEqual({
      avatar: "bg-emerald-100 text-emerald-700",
      chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      text: "text-emerald-700",
    });
  });

  it("is case-insensitive", () => {
    expect(personaColorStyle("BLUE")).toEqual(personaColorStyle("blue"));
  });

  it.each(["green", "blue", "orange", "purple", "red", "teal"])(
    "resolves every documented palette color (%s)",
    (color) => {
      expect(personaColorStyle(color).text).toMatch(/^text-/);
    },
  );

  it("falls back to slate for an unknown color", () => {
    expect(personaColorStyle("chartreuse").text).toBe("text-slate-700");
  });

  it("falls back to slate for undefined", () => {
    expect(personaColorStyle(undefined).avatar).toBe("bg-slate-100 text-slate-700");
  });
});

describe("personaInitials", () => {
  it("returns P for null/undefined/empty names", () => {
    expect(personaInitials(null)).toBe("P");
    expect(personaInitials(undefined)).toBe("P");
    expect(personaInitials("")).toBe("P");
  });

  it("builds two-letter initials from the first two words", () => {
    expect(personaInitials("Marketing Maven")).toBe("MM");
  });

  it("uppercases and caps at two characters", () => {
    expect(personaInitials("alpha beta gamma")).toBe("AB");
  });

  it("handles a single word", () => {
    expect(personaInitials("solo")).toBe("S");
  });

  it("falls back to P for a whitespace-only (but non-empty) name", () => {
    expect(personaInitials("   ")).toBe("P");
  });

  it("ignores extra whitespace", () => {
    expect(personaInitials("  john   doe  ")).toBe("JD");
  });
});
