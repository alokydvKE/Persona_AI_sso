import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

// --- MSW lifecycle -------------------------------------------------------
// `error` surfaces any request the suite didn't explicitly mock, so a typo'd
// URL fails loudly instead of hanging. Tests opt into real network never.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

// jsdom does not implement these browser APIs, but components/hooks across the
// app touch them (use-mobile -> matchMedia, sidebar/scroll behaviour ->
// ResizeObserver & scrollTo, lazy lists -> IntersectionObserver). Installing
// deterministic stubs here keeps individual tests from each re-mocking them and
// avoids "not a function" crashes during render.

// --- matchMedia ----------------------------------------------------------
function createMatchMedia() {
  return vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated, kept for older libs
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// --- IntersectionObserver ------------------------------------------------
class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

// --- ResizeObserver ------------------------------------------------------
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", createMatchMedia());
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  // jsdom's scrollTo / scrollIntoView are unimplemented no-ops by default.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Test env is isolated per-file, but storage is shared within a file; clear it
  // so persistence-backed modules (chatStore, auth) never leak state across tests.
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
