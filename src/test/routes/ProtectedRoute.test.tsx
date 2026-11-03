import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import type { JSX } from "react";
import ProtectedRoute from "../../routes/ProtectedRoute";

/**
 * Renders ProtectedRoute at `at` with a `/login` and `/` target available, so
 * we can assert which destination the guard resolves to by what renders.
 */
function renderGuard(
  guard: JSX.Element,
  { authed = false, at = "/private" }: { authed?: boolean; at?: string } = {},
) {
  if (authed) localStorage.setItem("token", "valid-token");
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/private" element={guard} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const Protected = <div>Protected Content</div>;

describe("ProtectedRoute", () => {
  describe("default (auth-required) mode", () => {
    it("renders the element when authenticated", () => {
      renderGuard(<ProtectedRoute element={Protected} />, { authed: true });
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("redirects to /login when not authenticated", () => {
      renderGuard(<ProtectedRoute element={Protected} />, { authed: false });
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });

    it("clears localStorage when unauthenticated", () => {
      localStorage.setItem("stale", "data");
      renderGuard(<ProtectedRoute element={Protected} />, { authed: false });
      expect(localStorage.getItem("stale")).toBeNull();
    });
  });

  describe("reverse mode (for login/signup pages)", () => {
    it("renders the element when NOT authenticated", () => {
      renderGuard(<ProtectedRoute element={Protected} reverse />, { authed: false });
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("redirects authenticated users to home", () => {
      renderGuard(<ProtectedRoute element={Protected} reverse />, { authed: true });
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  describe("adminOnly mode", () => {
    it("renders the element when authenticated", () => {
      renderGuard(<ProtectedRoute element={Protected} adminOnly />, { authed: true });
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("redirects to /login when not authenticated", () => {
      renderGuard(<ProtectedRoute element={Protected} adminOnly />, { authed: false });
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });
});
