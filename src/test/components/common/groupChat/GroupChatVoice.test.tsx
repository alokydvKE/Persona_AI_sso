import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, ndjsonBody, ndjsonStream } from "@/test/msw/handlers";
import { VOICE_ENDPOINTS } from "@/api/Voice/endpoints";
import { authenticate } from "@/test/factories";
import { speechPlayer } from "@/lib/voice/speechPlayer";
import { SPEAKER_PREFERENCE_KEY } from "@/hooks/useSpeakerPreference";
import GroupChatView from "../../../../components/common/Chat/GroupChat/GroupChatView";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

let routeGroupId = "g1";
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useParams: () => ({ groupId: routeGroupId }),
  useNavigate: () => vi.fn(),
}));

const participants = [
  { persona_id: "a", persona_name: "Ann", color: "green" },
  { persona_id: "b", persona_name: "Bob", color: "blue" },
];

function seedChat(history: unknown[] = []) {
  server.use(
    http.post(`${API_URL}persona/group-chat/participants`, () => ok({ participants })),
    http.post(`${API_URL}persona/group-chat/history`, () =>
      ok({ messages: history, pagination: { total: history.length } }),
    ),
    http.post(`${API_URL}persona/group-chat/assumptions/list`, () =>
      ok({ assumptions: [], count: 0, max_allowed: 20 }),
    ),
  );
}

function voiceConfig(stt: boolean, tts: boolean) {
  server.use(
    http.post(`${API_URL}${VOICE_ENDPOINTS.config}`, () => ok({ stt: { enabled: stt }, tts: { enabled: tts } })),
  );
}

let enqueue: MockInstance<typeof speechPlayer.enqueue>;
let stop: MockInstance<typeof speechPlayer.stop>;
let prime: MockInstance<typeof speechPlayer.prime>;

/** What the view fed the player as live utterances, in the order opened. */
type Voiced = {
  id: string;
  speakerKey?: string;
  groupId?: string;
  text: string;
  ended: boolean;
  discarded: boolean;
};
let voiced: Voiced[] = [];
const liveVoice = (id: string) => voiced.find((v) => v.id === id && !v.discarded);
/** [speaker, what was said, finished?] for every utterance not discarded. */
const spoken = () =>
  voiced.filter((v) => !v.discarded).map((v) => [v.speakerKey, v.text.trim(), v.ended]);

beforeEach(() => {
  routeGroupId = "g1";
  authenticate();
  voiced = [];
  // Real audio can't play in jsdom; assert on what the view asks the player to do.
  enqueue = vi.spyOn(speechPlayer, "enqueue").mockImplementation(() => {});
  stop = vi.spyOn(speechPlayer, "stop").mockImplementation(() => {});
  vi.spyOn(speechPlayer, "toggle").mockImplementation(() => {});
  prime = vi.spyOn(speechPlayer, "prime").mockImplementation(() => {});
  vi.spyOn(speechPlayer, "open").mockImplementation((info) => {
    voiced.push({ ...info, text: "", ended: false, discarded: false });
  });
  vi.spyOn(speechPlayer, "append").mockImplementation((id, text) => {
    const v = liveVoice(id);
    if (v && !v.ended) v.text += text;
  });
  vi.spyOn(speechPlayer, "end").mockImplementation((id) => {
    const v = liveVoice(id);
    if (v) v.ended = true;
  });
  vi.spyOn(speechPlayer, "discard").mockImplementation((id) => {
    const v = liveVoice(id);
    if (v) v.discarded = true;
  });
});

describe("GroupChatView voice", () => {
  it("hides voice controls when the backend has voice off", async () => {
    seedChat();
    voiceConfig(false, false);
    renderWithProviders(<GroupChatView />);
    await screen.findByPlaceholderText(/message everyone/i);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /read replies aloud/i })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /record voice message/i })).not.toBeInTheDocument();
  });

  it("hides the mic in browsers that can't record", async () => {
    seedChat();
    renderWithProviders(<GroupChatView />);
    expect(await screen.findByRole("button", { name: /read replies aloud/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record voice message/i })).not.toBeInTheDocument();
  });

  it("turns read-aloud on and off", async () => {
    seedChat();
    const { user } = renderWithProviders(<GroupChatView />);
    const toggleButton = await screen.findByRole("button", { name: "Read replies aloud" });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    await user.click(toggleButton);
    expect(prime).toHaveBeenCalled();
    const on = screen.getByRole("button", { name: /stop reading replies aloud/i });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(SPEAKER_PREFERENCE_KEY)).toBe("on");

    stop.mockClear();
    await user.click(on);
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read replies aloud" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("never reads history aloud", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat([
      {
        user_message: "What matters?",
        responses: [{ persona_id: "a", persona_name: "Ann", response: "Affordability" }],
      },
    ]);
    renderWithProviders(<GroupChatView />);
    expect(await screen.findByText("Affordability")).toBeInTheDocument();
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    expect(enqueue).not.toHaveBeenCalled();
    expect(voiced).toEqual([]);
  });

  it("reads broadcast replies aloud in order, as they stream", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonStream([
          { persona_id: "a", persona_name: "Ann", response: "Yes, I would." },
          { persona_id: "b", persona_name: "Bob", response: "No thanks." },
        ]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Launch?{Enter}");

    expect(stop).toHaveBeenCalled(); // a new question interrupts reading
    expect(prime).toHaveBeenCalled(); // sending unlocks audio for the replies
    await waitFor(() =>
      expect(spoken()).toEqual([
        ["Ann", "Yes, I would.", true],
        ["Bob", "No thanks.", true],
      ]),
    );
    // The group lets the backend use each persona's stored voice.
    expect(voiced.map((v) => v.groupId)).toEqual(["g1", "g1"]);
    // Streamed replies go through the live API, never as whole messages.
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("starts speaking a reply before it has finished streaming", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const line = (event: unknown) => new TextEncoder().encode(JSON.stringify(event) + "\n");
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () => {
        const body = new ReadableStream({
          async start(c) {
            c.enqueue(line({ type: "start", personas: [{ persona_id: "a", persona_name: "Ann" }] }));
            c.enqueue(line({ type: "persona_delta", persona_id: "a", delta: "First thought. " }));
            await gate;
            c.enqueue(line({ type: "persona_delta", persona_id: "a", delta: "Second thought." }));
            c.enqueue(line({ type: "persona_done", persona_id: "a" }));
            c.enqueue(
              line({
                type: "done",
                responses: [
                  {
                    persona_id: "a",
                    persona_name: "Ann",
                    response: "First thought. Second thought.",
                    evidence_tags: [],
                  },
                ],
              }),
            );
            c.close();
          },
        });
        return new HttpResponse(body, { headers: { "Content-Type": "application/x-ndjson" } });
      }),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Thoughts?{Enter}");

    // Mid-reply: the first sentence is already with the player.
    await waitFor(() => expect(spoken()).toEqual([["Ann", "First thought.", false]]));

    release();
    await waitFor(() =>
      expect(spoken()).toEqual([["Ann", "First thought. Second thought.", true]]),
    );
  });

  it("ends a reply once even when persona_done repeats", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonBody([
          { type: "start", personas: [{ persona_id: "a", persona_name: "Ann" }] },
          { type: "persona_delta", persona_id: "a", delta: "Yes please" },
          // The backend sends done when the text ends, then again with confidence.
          { type: "persona_done", persona_id: "a" },
          { type: "persona_done", persona_id: "a", confidence_level: "High Confidence" },
          {
            type: "done",
            responses: [
              { persona_id: "a", persona_name: "Ann", response: "Yes please", evidence_tags: [] },
            ],
          },
        ]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Launch?{Enter}");

    expect(await screen.findByText("Yes please")).toBeInTheDocument();
    await waitFor(() => expect(spoken()).toEqual([["Ann", "Yes please", true]]));
    expect(voiced).toHaveLength(1);
  });

  it("reads an off-topic fallback reply once, not once per persona", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    const fallback = "Let's keep to the product.";
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonBody([
          {
            type: "start",
            personas: [
              { persona_id: "a", persona_name: "Ann" },
              { persona_id: "b", persona_name: "Bob" },
            ],
          },
          { type: "fallback_delta", delta: fallback },
          {
            type: "done",
            responses: ["a", "b"].map((id, i) => ({
              persona_id: id,
              persona_name: i === 0 ? "Ann" : "Bob",
              response: fallback,
              evidence_tags: [],
              is_fallback: 1,
            })),
          },
        ]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Weather?{Enter}");

    await waitFor(() => expect(spoken()).toEqual([[undefined, fallback, true]]));
    expect(screen.getAllByText(fallback)).toHaveLength(1);
  });

  it("stops reading a reply that the server failed", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonBody([
          { type: "start", personas: [{ persona_id: "a", persona_name: "Ann" }] },
          { type: "persona_delta", persona_id: "a", delta: "Half a thought. And" },
          { type: "error", message: "Failed to generate persona responses" },
        ]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Hm?{Enter}");

    await waitFor(() => expect(voiced).toHaveLength(1));
    await waitFor(() => expect(voiced[0].discarded).toBe(true));
    expect(spoken()).toEqual([]);
  });

  it("doesn't read replies when read-aloud is off", async () => {
    seedChat();
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonStream([{ persona_id: "a", persona_name: "Ann", response: "Sure" }]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Hi{Enter}");
    expect(await screen.findByText("Sure")).toBeInTheDocument();
    expect(voiced).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
    expect(prime).not.toHaveBeenCalled();
  });

  // Per-message read-aloud button is hidden behind
  // PER_MESSAGE_SPEAKER_BUTTON_ENABLED = false in GroupChatView.tsx; flip that
  // flag back and restore this test to click it (see git history) once re-enabled.
  it("does not show a per-bubble read-aloud button while it's hidden", async () => {
    seedChat([
      {
        user_message: "What matters?",
        responses: [{ persona_id: "a", persona_name: "Ann", response: "Affordability" }],
      },
    ]);
    renderWithProviders(<GroupChatView />);
    const reply = await screen.findByText("Affordability");
    const bubble = reply.closest(".group") as HTMLElement;
    expect(within(bubble).queryByRole("button", { name: /read aloud/i })).not.toBeInTheDocument();
  });

  it("turns read-aloud off when the browser blocks playback", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    let blocked: () => void = () => {};
    vi.spyOn(speechPlayer, "onAutoplayBlocked").mockImplementation((listener) => {
      blocked = listener;
      return () => {};
    });
    seedChat();
    renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });

    blocked();
    expect(
      await screen.findByRole("button", { name: "Read replies aloud" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("drops replies that arrive after switching to another chat", async () => {
    localStorage.setItem(SPEAKER_PREFERENCE_KEY, "on");
    seedChat();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, async () => {
        await gate;
        return ndjsonStream([{ persona_id: "a", persona_name: "Ann", response: "Stale" }]);
      }),
    );
    const { user, rerender } = renderWithProviders(<GroupChatView />);
    await screen.findByRole("button", { name: /stop reading replies aloud/i });
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Hello{Enter}");

    routeGroupId = "g2";
    rerender(<GroupChatView />);
    release();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    expect(voiced).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  describe("dictation", () => {
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["x".repeat(4096)]) });
        this.onstop?.();
      }
    }

    beforeEach(() => {
      vi.stubGlobal("MediaRecorder", FakeRecorder);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
        },
      });
      // Every clock read moves a second on, so the clip is long enough to keep.
      let now = 0;
      vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
    });

    it("puts the transcript in the input without sending it", async () => {
      seedChat();
      let sent = false;
      server.use(
        http.post(`${API_URL}persona/group-chat/message/stream`, () => {
          sent = true;
          return HttpResponse.json({});
        }),
      );
      const { user } = renderWithProviders(<GroupChatView />);
      const input = await screen.findByPlaceholderText(/message everyone/i);
      await user.type(input, "Also,");

      await user.click(await screen.findByRole("button", { name: /record voice message/i }));
      expect(stop).toHaveBeenCalled(); // never records over a reply being read
      await user.click(await screen.findByRole("button", { name: /stop recording/i }));

      await waitFor(() => expect(input).toHaveValue("Also, hello from the mic"));
      expect(sent).toBe(false);
    });

    it("locks the rest of the bar and shows a timer while recording", async () => {
      seedChat();
      const { user } = renderWithProviders(<GroupChatView />);
      const input = await screen.findByPlaceholderText(/message everyone/i);
      await screen.findByRole("button", { name: /read replies aloud/i });

      await user.click(await screen.findByRole("button", { name: /record voice message/i }));
      expect(await screen.findByText("Listening")).toBeInTheDocument();
      // Counts down from the backend's limit.
      expect(screen.getByTestId("recording-timer")).toHaveTextContent("0:30");

      expect(input).toBeDisabled();
      expect(screen.getByRole("button", { name: /attach images/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /read replies aloud/i })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: /choose who to message/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /assumptions/i })).toBeDisabled();
      // The mic itself stays usable so recording can be stopped.
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: /discard recording/i }));
      await waitFor(() => expect(input).toBeEnabled());
      expect(screen.queryByText("Listening")).not.toBeInTheDocument();
      expect(input).toHaveValue("");
    });

    it("takes the recording limit from the backend config", async () => {
      seedChat();
      server.use(
        http.post(`${API_URL}${VOICE_ENDPOINTS.config}`, () =>
          ok({
            stt: { enabled: true },
            tts: { enabled: true },
            limits: { max_recording_seconds: 20 },
          }),
        ),
      );
      const { user } = renderWithProviders(<GroupChatView />);
      await screen.findByRole("button", { name: /read replies aloud/i });
      await user.click(await screen.findByRole("button", { name: /record voice message/i }));
      expect(await screen.findByTestId("recording-timer")).toHaveTextContent("0:20");
    });

    it("shows a transcribing message until the text arrives", async () => {
      seedChat();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      server.use(
        http.post(`${API_URL}${VOICE_ENDPOINTS.stt}`, async () => {
          await gate;
          return ok({ text: "done talking", duration_seconds: 1, latency_ms: 5 });
        }),
      );
      const { user } = renderWithProviders(<GroupChatView />);
      const input = await screen.findByPlaceholderText(/message everyone/i);

      await user.click(await screen.findByRole("button", { name: /record voice message/i }));
      await user.click(await screen.findByRole("button", { name: /stop recording/i }));

      expect(await screen.findByText(/transcribing your voice/i)).toBeInTheDocument();
      expect(input).toBeDisabled();

      release();
      await waitFor(() => expect(input).toHaveValue("done talking"));
      expect(input).toBeEnabled();
      expect(screen.queryByText(/transcribing your voice/i)).not.toBeInTheDocument();
    });
  });
});
