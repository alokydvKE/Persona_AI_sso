import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SignupForm } from "../../../../components/common/signup/signup-form";

vi.mock("react-google-recaptcha", () => ({
  default: ({ onChange }: { onChange: () => void }) => (
    <button type="button" data-testid="recaptcha" onClick={() => onChange()}>
      verify
    </button>
  ),
}));

describe("SignupForm", () => {
  it("renders the email field and a sign-in link", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("enables the create-account button only after the captcha is solved", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const submit = screen.getByRole("button", { name: "Create Account" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByTestId("recaptcha"));
    expect(submit).toBeEnabled();
  });
});
