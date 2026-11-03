import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http } from "msw";
import { toast } from "sonner";
import { server } from "@/test/msw/server";
import { API_URL, envelopeError, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { Login, Logout } from "@/api/Auth/mutation";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => navigateSpy.mockReset());

describe("Login mutation", () => {
  it("stores the user, toasts success and navigates to the dashboard", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => Login(), { wrapper: Wrapper });

    act(() => result.current.mutate({ email: "a@b.com", password: "pw" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stored = localStorage.getItem("user");
    expect(stored).not.toBeNull();
    expect(JSON.parse(atob(stored!)).token).toBe("test-token");
    expect(toast.success).toHaveBeenCalledWith("Logged in successfully");
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("enters an error state without storing a user on failure", async () => {
    server.use(
      http.post(`${API_URL}users/login`, () =>
        envelopeError(401, "Invalid credentials"),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => Login(), { wrapper: Wrapper });

    act(() => result.current.mutate({ email: "a@b.com", password: "bad" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(localStorage.getItem("user")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { id: "login-error" });
  });
});

describe("Logout mutation", () => {
  it("clears storage and navigates home on success", async () => {
    authenticate("tok");
    server.use(http.post(`${API_URL}users/logout`, () => ok({ message: "bye" })));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => Logout(), { wrapper: Wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });
});
