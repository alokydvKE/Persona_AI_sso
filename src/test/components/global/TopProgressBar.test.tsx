import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { renderWithProviders } from "@/test/test-utils";
import TopProgressBar from "../../../components/global/TopProgressBar";

// Drives useIsFetching by holding one query in a perpetually-fetching state.
function PendingQuery() {
  useQuery({ queryKey: ["pending"], queryFn: () => new Promise(() => {}) });
  return null;
}

describe("TopProgressBar", () => {
  it("renders nothing when no requests are in flight", () => {
    const { container } = renderWithProviders(<TopProgressBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a loading progress bar while a request is fetching", async () => {
    renderWithProviders(
      <>
        <PendingQuery />
        <TopProgressBar />
      </>,
    );
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-busy", "true");
  });
});
