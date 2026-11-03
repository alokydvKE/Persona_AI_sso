import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { voiceHandlers } from "./voiceHandlers";

/**
 * Shared MSW server for the whole suite. Lifecycle (listen/resetHandlers/close)
 * is wired in `src/test/setup.ts` so every test starts from the default
 * handlers. Tests add per-test overrides with `server.use(...)`.
 */
export const server = setupServer(...handlers, ...voiceHandlers);
