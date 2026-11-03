import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, delay, HttpResponse } from "msw";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import PersonaAILoginPage from "../../pages/Login2";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => navigateSpy.mockReset());

describe("PersonaAILoginPage", () => {
  it("renders the welcome heading and the credential fields", () => {
    renderWithProviders(<PersonaAILoginPage />);
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  it("logs in and navigates to the dashboard on success", async () => {
    server.use(
      http.post(`${API_URL}users/login`, () =>
        ok({ token: "tok", firstName: "Ada", lastName: "Lovelace" }),
      ),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "ada@x.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret12");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard"));
    expect(JSON.parse(atob(localStorage.getItem("user")!)).token).toBe("tok");
  });

  it("shows a verifying state while the request is in flight", async () => {
    server.use(
      http.post(`${API_URL}users/login`, async () => {
        await delay("infinite");
        return ok({ token: "t", firstName: "A", lastName: "B" });
      }),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "pw123456");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/verifying/i)).toBeInTheDocument();
  });

  it("checks the fields before sending anything", async () => {
    let requests = 0;
    server.use(
      http.post(`${API_URL}users/login`, () => {
        requests += 1;
        return ok({ token: "t", firstName: "A", lastName: "B" });
      }),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    const email = screen.getByPlaceholderText("Enter your email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();

    await user.type(email, "not-an-email");
    // Typing clears that field's message.
    expect(screen.queryByText("Enter your email address.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

    expect(requests).toBe(0);
  });

  it("toasts a rejected sign-in and stays on the page", async () => {
    localStorage.setItem("keep", "me");
    server.use(
      http.post(`${API_URL}users/login`, () =>
        HttpResponse.json({ header: { code: 401, message: "Invalid credentials." } }),
      ),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "ada@x.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials.", { id: "login-error" }),
    );
    // Exactly one toast (the request itself is silent), and no inline error text.
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    // No session teardown for a failed sign-in, and the form is usable again.
    expect(localStorage.getItem("keep")).toBe("me");
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("signs in with Enter", async () => {
    server.use(
      http.post(`${API_URL}users/login`, () =>
        ok({ token: "tok", firstName: "Ada", lastName: "Lovelace" }),
      ),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "ada@x.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret12{Enter}");

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard"));
  });

  it("won't store a session the server didn't issue a token for", async () => {
    server.use(
      http.post(`${API_URL}users/login`, () => ok({ firstName: "Ada", lastName: "L" })),
    );
    const { user } = renderWithProviders(<PersonaAILoginPage />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "ada@x.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret12");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't sign you in/i),
        { id: "login-error" },
      ),
    );
    expect(localStorage.getItem("user")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
