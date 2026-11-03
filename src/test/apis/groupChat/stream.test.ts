import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, envelopeError, ndjsonBody, ndjsonStream } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import {
  STREAM_IDLE_TIMEOUT_MS,
  STREAM_INTERRUPTED_MESSAGE,
  streamGroupChat,
  type StreamHandlers,
} from "@/api/GroupChat/stream";
import { handleSessionExpiration } from "@/services/apiService";

vi.mock("@/services/apiService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/apiService")>()),
  handleSessionExpiration: vi.fn(),
}));

const BROADCAST = `${API_URL}persona/group-chat/message/stream`;
const SINGLE = `${API_URL}persona/group-chat/message-single/stream`;

const START = { type: "start", personas: [{ persona_id: "a", persona_name: "Ann" }] };
const DONE = {
  type: "done",
  responses: [{ persona_id: "a", persona_name: "Ann", response: "Hi", evidence_tags: [] }],
  images: [],
};

/** Every handler as a spy, plus the ordered list of event names seen. */
function spyHandlers() {
  const seen: string[] = [];
  const track = (name: string) => () => {
    seen.push(name);
  };
  type H = Required<StreamHandlers>;
  const handlers = {
    onStart: vi.fn<H["onStart"]>(track("start")),
    onPersonaDelta: vi.fn<H["onPersonaDelta"]>(track("delta")),
    onPersonaDone: vi.fn<H["onPersonaDone"]>(track("persona_done")),
    onFallbackDelta: vi.fn<H["onFallbackDelta"]>(track("fallback")),
    onDone: vi.fn<H["onDone"]>(track("done")),
    onError: vi.fn<H["onError"]>(track("error")),
  };
  return { handlers, seen };
}

const send = (handlers: StreamHandlers, extra: Record<string, unknown> = {}) =>
  streamGroupChat({ groupId: "g1", message: "Hello?", ...extra }, handlers);

beforeEach(() => {
  authenticate();
  vi.mocked(handleSessionExpiration).mockClear();
});

describe("streamGroupChat", () => {
  it("dispatches events in order and finishes with done", async () => {
    server.use(
      http.post(BROADCAST, () =>
        ndjsonStream([{ persona_id: "a", persona_name: "Ann", response: "Hello there" }]),
      ),
    );
    const { handlers, seen } = spyHandlers();
    await send(handlers);

    expect(seen).toEqual(["start", "delta", "delta", "persona_done", "done"]);
    const text = handlers.onPersonaDelta.mock.calls.map(([e]) => e.delta).join("");
    expect(text).toBe("Hello there");
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("posts the broadcast payload, or the single-persona one", async () => {
    const bodies: Record<string, unknown>[] = [];
    const capture = async ({ request }: { request: Request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return ndjsonBody([START, DONE]);
    };
    server.use(http.post(BROADCAST, capture), http.post(SINGLE, capture));

    await send(spyHandlers().handlers, { fileIds: ["f1"] });
    await send(spyHandlers().handlers, { personaId: "a", fileIds: [] });

    expect(bodies[0]).toMatchObject({ group_id: "g1", message: "Hello?", flow: "message", file_ids: ["f1"] });
    expect(bodies[0]).not.toHaveProperty("persona_id");
    expect(bodies[1]).toMatchObject({ group_id: "g1", persona_id: "a" });
    // An empty attachment list is not sent at all.
    expect(bodies[1]).not.toHaveProperty("file_ids");
    expect(bodies[1]).not.toHaveProperty("flow");
  });

  it("reassembles lines and multi-byte characters split across chunks", async () => {
    const reply = "Café ☕ — naïve 中文 reply";
    server.use(
      http.post(BROADCAST, () =>
        ndjsonBody(
          [START, { type: "persona_delta", persona_id: "a", delta: reply }, DONE],
          { chunkBytes: 3 },
        ),
      ),
    );
    const { handlers } = spyHandlers();
    await send(handlers);

    expect(handlers.onPersonaDelta).toHaveBeenCalledTimes(1);
    expect(handlers.onPersonaDelta.mock.calls[0][0].delta).toBe(reply);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("ignores pings, unknown events, malformed and mis-shaped lines", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(
      http.post(BROADCAST, () =>
        ndjsonBody([
          START,
          { type: "ping" },
          "{not json",
          { type: "something_new", value: 1 },
          { type: "persona_delta", persona_id: "a" }, // no delta
          { type: "persona_delta", persona_id: "a", delta: "ok" },
          DONE,
        ]),
      ),
    );
    const { handlers, seen } = spyHandlers();
    await send(handlers);

    expect(seen).toEqual(["start", "delta", "done"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports a server error line once and nothing after it", async () => {
    server.use(
      http.post(BROADCAST, () =>
        ndjsonBody([
          START,
          { type: "error", message: "Failed to generate persona responses" },
          { type: "persona_delta", persona_id: "a", delta: "late" },
          DONE,
        ]),
      ),
    );
    const { handlers, seen } = spyHandlers();
    await send(handlers);

    expect(seen).toEqual(["start", "error"]);
    expect(handlers.onError).toHaveBeenCalledWith("Failed to generate persona responses", {});
  });

  it("unwraps a pre-generation envelope rejection", async () => {
    server.use(http.post(BROADCAST, () => envelopeError(400, "Group chat has already ended")));
    const { handlers, seen } = spyHandlers();
    await send(handlers);

    expect(seen).toEqual(["error"]);
    expect(handlers.onError).toHaveBeenCalledWith("Group chat has already ended", { code: 400 });
    expect(handleSessionExpiration).not.toHaveBeenCalled();
  });

  it("ends the session on a 401 envelope", async () => {
    server.use(http.post(BROADCAST, () => envelopeError(401, "Session expired")));
    const { handlers } = spyHandlers();
    await send(handlers);

    expect(handleSessionExpiration).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith("Session expired", { code: 401 });
  });

  it("reports a non-OK HTTP status with no envelope", async () => {
    server.use(http.post(BROADCAST, () => new HttpResponse("Bad gateway", { status: 502 })));
    const { handlers } = spyHandlers();
    await send(handlers);

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError.mock.calls[0][1]).toEqual({ code: 502 });
  });

  it("treats a body that ends without done as an interrupted stream", async () => {
    server.use(
      http.post(BROADCAST, () =>
        ndjsonBody([START, { type: "persona_delta", persona_id: "a", delta: "Half a" }]),
      ),
    );
    const { handlers, seen } = spyHandlers();
    await send(handlers);

    expect(seen).toEqual(["start", "delta", "error"]);
    expect(handlers.onError).toHaveBeenCalledWith(STREAM_INTERRUPTED_MESSAGE, { interrupted: true });
  });

  it("reports a network failure", async () => {
    server.use(http.post(BROADCAST, () => HttpResponse.error()));
    const { handlers } = spyHandlers();
    await send(handlers);

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError.mock.calls[0][0]).toMatch(/network/i);
    expect(handlers.onError.mock.calls[0][1]).toEqual({ interrupted: false });
  });

  it("stores a refreshed bearer token from the response", async () => {
    server.use(
      http.post(BROADCAST, () =>
        ndjsonBody([START, DONE], { headers: { Authorization: "fresh-token" } }),
      ),
    );
    await send(spyHandlers().handlers);
    expect(localStorage.getItem("token")).toBe("fresh-token");
  });

  it("calls nothing when aborted before sending", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const controller = new AbortController();
    controller.abort();
    const { handlers, seen } = spyHandlers();
    await send(handlers, { signal: controller.signal });

    expect(seen).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("calls nothing when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    server.use(
      http.post(BROADCAST, () => {
        const body = new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(JSON.stringify(START) + "\n"));
            // Never closes: only the abort can end this stream.
          },
        });
        return new HttpResponse(body, { headers: { "Content-Type": "application/x-ndjson" } });
      }),
    );
    const { handlers, seen } = spyHandlers();
    handlers.onStart.mockImplementation(() => {
      seen.push("start");
      controller.abort();
    });
    await send(handlers, { signal: controller.signal });

    expect(seen).toEqual(["start"]);
  });
});

describe("streamGroupChat idle watchdog", () => {
  afterEach(() => vi.useRealTimers());

  it("gives up on a stream that goes silent", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const encoder = new TextEncoder();
    server.use(
      http.post(BROADCAST, () => {
        const body = new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(JSON.stringify(START) + "\n"));
          },
        });
        return new HttpResponse(body, { headers: { "Content-Type": "application/x-ndjson" } });
      }),
    );
    const { handlers } = spyHandlers();
    const done = send(handlers);
    await vi.waitFor(() => expect(handlers.onStart).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS + 1);
    await done;

    expect(handlers.onError).toHaveBeenCalledWith(STREAM_INTERRUPTED_MESSAGE, { interrupted: true });
  });
});
