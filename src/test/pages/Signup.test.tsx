import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SignupPage from "../../pages/Signup";

vi.mock("react-google-recaptcha", () => ({
  default: ({ onChange }: { onChange: () => void }) => (
    <button type="button" data-testid="recaptcha" onClick={() => onChange()}>
      verify
    </button>
  ),
}));

describe("SignupPage", () => {
  it("renders the signup form", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Account" }),
    ).toBeInTheDocument();
  });
});
