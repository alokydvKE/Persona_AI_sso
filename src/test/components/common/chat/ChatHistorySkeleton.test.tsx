import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ChatHistorySkeleton from "../../../../components/common/Chat/ChatHistorySkeleton";

describe("ChatHistorySkeleton", () => {
  it("renders placeholder skeleton blocks", () => {
    const { container } = render(<ChatHistorySkeleton />);
    expect(container.firstChild).not.toBeNull();
    // Several skeleton bars are rendered while history loads.
    expect(container.querySelectorAll("div").length).toBeGreaterThan(3);
  });
});
