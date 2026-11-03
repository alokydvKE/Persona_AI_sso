import { describe, it, expect } from "vitest";
import { cn, getInitials, GetHtmlTitle } from "../../lib/utils";

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("merges conflicting tailwind classes, last one wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("supports conditional object and array syntax", () => {
    expect(cn(["text-sm", { hidden: false, block: true }])).toBe("text-sm block");
  });
});

describe("getInitials", () => {
  it("returns NA for empty, whitespace, or undefined input", () => {
    expect(getInitials()).toBe("NA");
    expect(getInitials("")).toBe("NA");
    expect(getInitials("   ")).toBe("NA");
  });

  it("uses the first letter of the first two words, uppercased", () => {
    expect(getInitials("john doe")).toBe("JD");
    expect(getInitials("Jane Mary Watson")).toBe("JM");
  });

  it("collapses extra whitespace between words", () => {
    expect(getInitials("john    doe")).toBe("JD");
  });

  it("uses the first two letters when there is a single long word", () => {
    expect(getInitials("Alice")).toBe("AL");
  });

  it("appends X for a single one-character name", () => {
    expect(getInitials("a")).toBe("AX");
  });
});

describe("GetHtmlTitle", () => {
  it("prefers the first heading's text", () => {
    expect(GetHtmlTitle("<div><h2>My Heading</h2><p>body</p></div>")).toBe(
      "My Heading",
    );
  });

  it("falls back to text content when there is no heading", () => {
    expect(GetHtmlTitle("<p>Just a paragraph</p>")).toBe("Just a paragraph");
  });

  it("returns the default for empty or markup-only html", () => {
    expect(GetHtmlTitle("")).toBe("Untitled Chat");
    expect(GetHtmlTitle("<br/>")).toBe("Untitled Chat");
  });

  it("trims surrounding whitespace from the heading", () => {
    expect(GetHtmlTitle("<h1>   Spaced   </h1>")).toBe("Spaced");
  });
});
