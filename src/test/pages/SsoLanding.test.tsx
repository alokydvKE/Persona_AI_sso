import { describe, it, expect, vi, beforeEach, onTestFinished } from "vitest";
import { configure, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL } from "@/test/msw/handlers";
import SsoLandingPage, { readLaunchCode } from "../../pages/SsoLanding";

const { navigateSpy, toastInfo } = vi.hoisted(() => ({ navigateSpy: vi.fn(), toastInfo: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

const CODE = "A".repeat(43);
const REDEEM = `${API_URL}users/sso/redeem`;

function openWithHash(hash: string) {
  window.history.replaceState(null, "", `/sso${hash}`);
}

function signedInAs(firstName: string, lastName: string) {
  localStorage.setItem("token", "old-access-token");
  localStorage.setItem("user", btoa(JSON.stringify({ token: "old", firstName, lastName })));
}

function redeemSignsInPriya() {
  server.use(
    http.post(REDEEM, () =>
      HttpResponse.json(
        {
          header: { code: 200, message: "Success" },
          response: { token: "tok", firstName: "Priya", lastName: "Shah", launch: { action: "open" } },
        },
        { headers: { Authorization: "aes-access-token", "Access-Control-Expose-Headers": "Authorization" } },
      ),
    ),
  );
}

function redeemWaitsThenExpires() {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  server.use(
    http.post(REDEEM, async () => {
      await gate;
      return HttpResponse.json({
        header: { code: 400, message: "This sign-in link has expired or was already used." },
        response: { reason: "INVALID_CODE" },
      });
    }),
  );
  return release;
}

beforeEach(() => {
  navigateSpy.mockReset();
  toastInfo.mockReset();
  localStorage.clear();
});

describe("readLaunchCode", () => {
  it("reads the code from the URL fragment", () => {
    expect(readLaunchCode(`#code=${CODE}`)).toBe(CODE);
    expect(readLaunchCode("#other=1")).toBe("");
    expect(readLaunchCode("")).toBe("");
  });
});

describe("SsoLandingPage", () => {
  it("signs in like the login page and opens the dashboard", async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(REDEEM, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json(
          {
            header: { code: 200, message: "Success" },
            response: { token: "tok", firstName: "Priya", lastName: "Shah", launch: { action: "open" } },
          },
          { headers: { Authorization: "aes-access-token", "Access-Control-Expose-Headers": "Authorization" } },
        );
      }),
    );
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(seen).toEqual([{ code: CODE }]);
    expect(localStorage.getItem("token")).toBe("aes-access-token");
    expect(JSON.parse(atob(localStorage.getItem("user")!))).toEqual({
      token: "tok", firstName: "Priya", lastName: "Shah",
    });
    // The one-time code is removed from the address bar.
    expect(window.location.hash).toBe("");
  });

  it("sends the code once and doesn't abort it under StrictMode, which cleans up the effect right after mounting", async () => {
    // StrictMode at the top of the tree, as in main.tsx. Nested inside the test
    // providers it doesn't clean up the effect, so the bug wouldn't show.
    configure({ reactStrictMode: true });
    onTestFinished(() => configure({ reactStrictMode: false }));
    // The mocked network may ignore an abort, so check the request's own signal.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    onTestFinished(() => fetchSpy.mockRestore());
    server.use(
      http.post(REDEEM, () =>
        HttpResponse.json(
          {
            header: { code: 200, message: "Success" },
            response: { token: "tok", firstName: "Priya", lastName: "Shah", launch: { action: "open" } },
          },
          { headers: { Authorization: "aes-access-token", "Access-Control-Expose-Headers": "Authorization" } },
        ),
      ),
    );
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    const redeems = fetchSpy.mock.calls.filter(([url]) => String(url) === REDEEM);
    expect(redeems).toHaveLength(1);
    expect(redeems[0][1]?.signal?.aborted ?? false).toBe(false);
  });

  it("explains a missing account", async () => {
    server.use(
      http.post(REDEEM, () =>
        HttpResponse.json({
          header: { code: 404, message: "There is no Persona AI account for priya@acme.com." },
          response: { reason: "NO_ACCOUNT", email: "priya@acme.com" },
        }),
      ),
    );
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);

    expect(await screen.findByRole("heading", { name: "No Persona AI account yet" })).toBeInTheDocument();
    expect(screen.getByText("priya@acme.com")).toBeInTheDocument();
    expect(localStorage.getItem("user")).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("explains an expired link", async () => {
    server.use(
      http.post(REDEEM, () =>
        HttpResponse.json({
          header: { code: 400, message: "This sign-in link has expired or was already used." },
          response: { reason: "INVALID_CODE" },
        }),
      ),
    );
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    expect(await screen.findByRole("heading", { name: "This sign-in link has expired" })).toBeInTheDocument();
  });

  it("rejects a malformed link without calling the backend", async () => {
    const calls = vi.fn();
    server.use(http.post(REDEEM, () => { calls(); return HttpResponse.json({}); }));
    openWithHash("#code=nope");
    renderWithProviders(<SsoLandingPage />);
    expect(await screen.findByRole("heading", { name: "This sign-in link has expired" })).toBeInTheDocument();
    expect(calls).not.toHaveBeenCalled();
  });

  it("offers the password sign-in when it fails", async () => {
    server.use(http.post(REDEEM, () => HttpResponse.error()));
    openWithHash(`#code=${CODE}`);
    const { user } = renderWithProviders(<SsoLandingPage />);
    await user.click(await screen.findByRole("button", { name: "Sign in with password" }));
    expect(navigateSpy).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("says it is signing you in when nobody is signed in", async () => {
    const release = redeemWaitsThenExpires();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    expect(screen.getByRole("heading", { name: "Signing you in…" })).toBeInTheDocument();
    release();
    await screen.findByRole("heading", { name: "This sign-in link has expired" });
  });

  it("stays quiet about accounts on a fresh sign-in", async () => {
    redeemSignsInPriya();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(toastInfo).not.toHaveBeenCalled();
  });
});

describe("SsoLandingPage when someone is already signed in", () => {
  it("says it is opening Persona AI", async () => {
    signedInAs("Priya", "Shah");
    const release = redeemWaitsThenExpires();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    expect(screen.getByRole("heading", { name: "Opening Persona AI…" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Signing you in…" })).not.toBeInTheDocument();
    release();
    await screen.findByRole("heading", { name: "This sign-in link has expired" });
  });

  it("stays quiet when it is the same person", async () => {
    signedInAs("Priya", "Shah");
    redeemSignsInPriya();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(toastInfo).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBe("aes-access-token");
  });

  it("says so when it replaced someone else's session", async () => {
    signedInAs("Asha", "Rao");
    redeemSignsInPriya();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(toastInfo).toHaveBeenCalledWith("You're now signed in as Priya Shah.", { duration: 8000 });
    expect(JSON.parse(atob(localStorage.getItem("user")!)).firstName).toBe("Priya");
  });

  it("copes with an unreadable stored user", async () => {
    localStorage.setItem("token", "old-access-token");
    localStorage.setItem("user", "not base64 json");
    redeemSignsInPriya();
    openWithHash(`#code=${CODE}`);
    renderWithProviders(<SsoLandingPage />);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("offers to continue when the link fails, and keeps the session", async () => {
    signedInAs("Priya", "Shah");
    server.use(
      http.post(REDEEM, () =>
        HttpResponse.json({
          header: { code: 400, message: "This sign-in link has expired or was already used." },
          response: { reason: "INVALID_CODE" },
        }),
      ),
    );
    openWithHash(`#code=${CODE}`);
    const { user } = renderWithProviders(<SsoLandingPage />);

    await user.click(await screen.findByRole("button", { name: "Continue to Persona AI" }));

    expect(navigateSpy).toHaveBeenCalledWith("/dashboard", { replace: true });
    // /login sends a signed-in user away, so don't offer it.
    expect(screen.queryByRole("button", { name: "Sign in with password" })).not.toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe("old-access-token");
    expect(JSON.parse(atob(localStorage.getItem("user")!)).firstName).toBe("Priya");
  });
});
