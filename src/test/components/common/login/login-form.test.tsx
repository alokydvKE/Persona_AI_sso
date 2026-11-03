import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { LoginForm } from "../../../../components/common/login/login-form";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Stub the third-party captcha widget with a button that fires its onChange,
// so tests can simulate a human passing the challenge.
vi.mock("react-google-recaptcha", () => ({
  default: ({ onChange }: { onChange: () => void }) => (
    <button type="button" data-testid="recaptcha" onClick={() => onChange()}>
      verify
    </button>
  ),
}));

const VALID_EMAIL = "test-user@persona.ai";
const VALID_PASSWORD = "Persona$!555";

async function fillCredentials(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByPlaceholderText("********"), password);
}

beforeEach(() => navigateSpy.mockReset());

describe("LoginForm", () => {
  it("keeps the submit button disabled until the captcha is solved", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: "Login" })).toBeDisabled();
    await user.click(screen.getByTestId("recaptcha"));
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });

  it("logs in a known user and navigates home", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user, VALID_EMAIL, VALID_PASSWORD);
    await user.click(screen.getByTestId("recaptcha"));
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(localStorage.getItem("token")).not.toBeNull();
    expect(JSON.parse(atob(localStorage.getItem("user")!)).email).toBe(VALID_EMAIL);
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  it("shows an error and does not navigate for an unknown email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user, "nobody@example.com", "whatever1");
    await user.click(screen.getByTestId("recaptcha"));
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(toast.error).toHaveBeenCalledWith("User not found");
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("shows an error for a wrong password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user, VALID_EMAIL, "wrong-password");
    await user.click(screen.getByTestId("recaptcha"));
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(toast.error).toHaveBeenCalledWith("invalid Credentials");
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
