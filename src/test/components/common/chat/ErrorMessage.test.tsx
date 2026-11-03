import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorMessage from "../../../../components/common/Chat/ErrorMessage";

describe("ErrorMessage", () => {
  it("renders the error message text", () => {
    render(<ErrorMessage error={new Error("Something failed")} />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("renders an empty message gracefully", () => {
    const { container } = render(<ErrorMessage error={new Error("")} />);
    expect(container).toBeInTheDocument();
  });
});
