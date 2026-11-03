/* eslint-disable react-refresh/only-export-components */
import { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProjectReducer from "@/redux/ProjectSlice";
import GlobalModalReducer from "@/redux/GlobalModalSlice";

/**
 * Shared rendering kit for component/page/hook tests.
 *
 * Every test that renders a component needs the same provider stack (React
 * Query + Redux + Router). Centralising it here keeps individual tests free of
 * boilerplate and guarantees a *fresh*, isolated store and query client per
 * render so no state leaks between tests.
 */

// Mirror the production rootReducer so preloadedState is type-checked against
// the real shape without importing the singleton store (which we never want in
// tests — it would be shared across every test).
const rootReducer = combineReducers({
  Project: ProjectReducer,
  GlobalModal: GlobalModalReducer,
});

export type TestRootState = ReturnType<typeof rootReducer>;
export type TestStore = ReturnType<typeof makeStore>;

export function makeStore(preloadedState?: Partial<TestRootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as TestRootState | undefined,
  });
}

/**
 * A QueryClient tuned for tests: retries OFF (so an errored request fails fast
 * and deterministically instead of retrying for seconds) and no caching between
 * instances.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type ExtraRenderOptions = Omit<RenderOptions, "wrapper"> & {
  /** Initial router entries; first entry is the active location. */
  route?: string;
  routerEntries?: string[];
  preloadedState?: Partial<TestRootState>;
  store?: TestStore;
  queryClient?: QueryClient;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    routerEntries,
    preloadedState,
    store = makeStore(preloadedState),
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: ExtraRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <MemoryRouter initialEntries={routerEntries ?? [route]}>
            <TooltipProvider>{children}</TooltipProvider>
          </MemoryRouter>
        </Provider>
      </QueryClientProvider>
    );
  }

  return {
    store,
    queryClient,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/** Provider wrapper for renderHook (no router by default; opt in via withRouter). */
export function createHookWrapper(options?: {
  preloadedState?: Partial<TestRootState>;
  queryClient?: QueryClient;
  withRouter?: boolean;
  routerEntries?: string[];
}) {
  const store = makeStore(options?.preloadedState);
  const queryClient = options?.queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>{children}</Provider>
      </QueryClientProvider>
    );
    if (options?.withRouter) {
      return (
        <MemoryRouter initialEntries={options.routerEntries ?? ["/"]}>
          {tree}
        </MemoryRouter>
      );
    }
    return tree;
  }

  return { Wrapper, store, queryClient };
}

// Re-export the full RTL surface + userEvent so tests import from one place.
export * from "@testing-library/react";
export { userEvent };
