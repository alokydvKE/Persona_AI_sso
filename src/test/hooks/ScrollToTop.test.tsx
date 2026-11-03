import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import ScrollToTop from "../../hooks/ScrollToTop";

// window.scrollTo is stubbed as a vi.fn() in src/test/setup.ts.

function Navigator() {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/dashboard")} type="button">
      go
    </button>
  );
}

describe("ScrollToTop", () => {
  beforeEach(() => vi.mocked(window.scrollTo).mockClear());

  it("scrolls to the top on initial render", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
      </MemoryRouter>,
    );
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("scrolls to the top again when the route changes", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
        <Navigator />
      </MemoryRouter>,
    );
    vi.mocked(window.scrollTo).mockClear();

    act(() => getByText("go").click());
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("renders nothing", () => {
    const { container } = render(
      <MemoryRouter>
        <ScrollToTop />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
