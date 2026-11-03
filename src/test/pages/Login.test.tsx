import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import LoginPage from "../../pages/Login";

vi.mock("react-google-recaptcha", () => ({
  default: ({ onChange }: { onChange: () => void }) => (
    <button type="button" data-testid="recaptcha" onClick={() => onChange()}>
      verify
    </button>
  ),
}));

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });
});
