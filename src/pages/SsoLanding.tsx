import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import AuroraBackground from "@/components/global/AuroraBackground";
import { Button } from "@/components/ui/button";
import { GradientRingLoader } from "@/components/ui/loader";
import { apiUrl, storeRefreshedToken } from "@/lib/streamFetch";

/**
 * Landing page for the SSO orchestrator's cookie-free app launch.
 *
 * The SSO portal opens Persona at /sso#code=<one-time code>. The code is in the
 * URL fragment, so it never reaches a server; this page removes it from the
 * address bar at once and posts it to /users/sso/redeem. The backend redeems it
 * with the orchestrator (server to server), finds the user by email and answers
 * exactly like /users/login: the access token in the Authorization header and
 * {token, firstName, lastName} in the body, stored the same way the login page
 * stores them (api/Auth/mutation.tsx). If someone is already signed in, this
 * replaces their session; the page says "Opening" rather than "Signing you in",
 * and a failed link leaves that session as it was.
 */

const CODE_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

type Failure = { title: string; message: string; reason: string; email?: string };

const TITLES: Record<string, string> = {
  INVALID_CODE: "This sign-in link has expired",
  NO_ACCOUNT: "No Persona AI account yet",
  SSO_UNAVAILABLE: "Single sign-on is unavailable",
  NETWORK: "Couldn't reach Persona AI",
};

// eslint-disable-next-line react-refresh/only-export-components
export function readLaunchCode(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return (params.get("code") ?? "").trim();
}

function fullName(user?: { firstName?: string; lastName?: string } | null): string {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

// Who the stored session belongs to. It holds no email, only the name.
function storedUserName(): string {
  try {
    return fullName(JSON.parse(atob(localStorage.getItem("user") ?? "")));
  } catch {
    return "";
  }
}

export default function SsoLandingPage() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<Failure | null>(null);
  // Read once, before a successful sign-in replaces it.
  const [hasSession] = useState(() => !!localStorage.getItem("token"));
  // React StrictMode runs effects twice in development; the code is single use,
  // so send it once and let it finish: don't abort it when the effect cleans up.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = readLaunchCode(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);
    const previousName = storedUserName();

    const fail =(reason: string, message: string, email?: string) =>
      setFailure({ title: TITLES[reason] ?? "We couldn't sign you in", message, reason, email });

    if (!CODE_PATTERN.test(code)) {
      fail("INVALID_CODE", "This sign-in link is not valid. Go back and click the app again.");
      return;
    }

    (async () => {
      let res: Response;
      try {
        res = await fetch(apiUrl("users/sso/redeem"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
      } catch {
        fail("NETWORK", "Check your connection and try again.");
        return;
      }

      const body = await res.json().catch(() => null);
      const header = body?.header ?? {};
      const data = body?.response ?? {};

      if (res.ok && header.code === 200 && data.token && res.headers.get("authorization")) {
        storeRefreshedToken(res); // Authorization header -> localStorage "token"
        localStorage.setItem(
          "user",
          btoa(JSON.stringify({ token: data.token, firstName: data.firstName, lastName: data.lastName })),
        );
        navigate("/dashboard", { replace: true });
        // Only when this replaced someone else's session, so the switch isn't silent.
        const name = fullName(data);
        if (previousName && name && name !== previousName) {
          toast.info(`You're now signed in as ${name}.`, { duration: 8000 });
        }
        return;
      }
      fail(
        data.reason ?? "SSO_FAILED",
        header.message ?? "Please sign in with your email and password.",
        data.email,
      );
    })();
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#eef1ff] via-[#f8f9ff] to-[#e8ecff] p-4 font-sans">
      <AuroraBackground />
      <div className="relative w-full max-w-md rounded-[28px] border border-white/60 bg-white p-8 text-center shadow-[0_20px_80px_rgba(99,56,246,0.08)]">
        {!failure ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
            <GradientRingLoader />
            <h1 className="text-xl font-semibold text-foreground">
              {hasSession ? "Opening Persona AI…" : "Signing you in…"}
            </h1>
            <p className="text-sm text-muted-foreground">This only takes a moment.</p>
          </div>
        ) : (
          <div role="alert" className="flex flex-col items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{failure.title}</h1>
            <p className="text-sm text-muted-foreground">{failure.message}</p>
            {failure.reason === "NO_ACCOUNT" && failure.email && (
              <p className="text-sm text-muted-foreground">
                Ask your admin to create a Persona AI account for{" "}
                <span className="font-medium break-all text-foreground">{failure.email}</span>.
              </p>
            )}
            {/* /login sends a signed-in user away, so only offer it when signed out. */}
            {hasSession ? (
              <Button className="mt-4" onClick={() => navigate("/dashboard", { replace: true })}>
                Continue to Persona AI
              </Button>
            ) : (
              <Button className="mt-4" onClick={() => navigate("/login", { replace: true })}>
                Sign in with password
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
