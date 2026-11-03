import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Html } from "../../../components/global/Html";

describe("Html", () => {
  it("renders safe HTML content", () => {
    const { container } = render(<Html>{"<p>Hello <strong>world</strong></p>"}</Html>);
    expect(container.querySelector("strong")?.textContent).toBe("world");
    expect(container.textContent).toContain("Hello");
  });

  it("strips dangerous markup (sanitization)", () => {
    const { container } = render(
      <Html>{'<img src=x onerror="alert(1)"><p>safe</p>'}</Html>,
    );
    // The onerror handler is removed by DOMPurify.
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
    expect(container.textContent).toContain("safe");
  });

  it("applies the provided id and className", () => {
    const { container } = render(
      <Html id="block-1" className="prose">
        {"<span>x</span>"}
      </Html>,
    );
    const el = container.querySelector("#block-1");
    expect(el).toHaveClass("prose");
  });
});
