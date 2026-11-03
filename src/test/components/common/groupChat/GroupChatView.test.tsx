import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, envelopeError, ndjsonBody, ndjsonStream } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import { upsertSession } from "@/lib/chatStore";
import GroupChatView from "../../../../components/common/Chat/GroupChat/GroupChatView";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useParams: () => ({ groupId: "g1" }),
  useNavigate: () => vi.fn(),
}));

const participants = [
  { persona_id: "a", persona_name: "Ann", color: "green" },
  { persona_id: "b", persona_name: "Bob", color: "blue" },
];

function seedParticipants() {
  server.use(
    http.post(`${API_URL}persona/group-chat/participants`, () => ok({ participants })),
  );
}

function seedNoHistory() {
  server.use(
    http.post(`${API_URL}persona/group-chat/history`, () =>
      ok({ messages: [], pagination: { total: 0 } }),
    ),
  );
}

function seedAssumptions(assumptions: GroupAssumption[]) {
  server.use(
    http.post(`${API_URL}persona/group-chat/assumptions/list`, () =>
      ok({ assumptions, count: assumptions.length, max_allowed: 20 }),
    ),
  );
}

beforeEach(() => authenticate());

describe("GroupChatView", () => {
  it("renders the transcript history", async () => {
    seedParticipants();
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({
          messages: [
            {
              user_message: "What matters?",
              responses: [{ persona_id: "a", persona_name: "Ann", response: "Affordability" }],
            },
          ],
          pagination: { total: 1 },
        }),
      ),
    );
    renderWithProviders(<GroupChatView />);

    expect(await screen.findByText("What matters?")).toBeInTheDocument();
    expect(screen.getByText("Affordability")).toBeInTheDocument();
  });

  it("shows a saved fallback turn once, not once per persona", async () => {
    seedParticipants();
    const fallback = "Please attach the image you'd like us to react to.";
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({
          messages: [
            {
              user_message: "What do you think of this packaging?",
              responses: participants.map((p) => ({
                persona_id: p.persona_id,
                persona_name: p.persona_name,
                response: fallback,
                is_fallback: 1,
              })),
            },
          ],
          pagination: { total: 1 },
        }),
      ),
    );
    renderWithProviders(<GroupChatView />);

    expect(await screen.findByText(fallback)).toBeInTheDocument();
    expect(screen.getAllByText(fallback)).toHaveLength(1);
    // Not attributed to a persona, so it can't be replied to.
    expect(screen.queryByText("Ann")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply to/i })).not.toBeInTheDocument();
  });

  it("streams a fallback as one reply for the whole group", async () => {
    seedParticipants();
    seedNoHistory();
    const fallback = "That's outside what we can speak to.";
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        ndjsonBody([
          { type: "start", personas: participants },
          { type: "fallback_delta", delta: "That's outside " },
          { type: "fallback_delta", delta: "what we can speak to." },
          {
            type: "done",
            responses: participants.map((p) => ({
              persona_id: p.persona_id,
              persona_name: p.persona_name,
              response: fallback,
              evidence_tags: [],
              is_fallback: 1,
            })),
          },
        ]),
      ),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Weather?{Enter}");

    expect(await screen.findByText(fallback)).toBeInTheDocument();
    expect(screen.getAllByText(fallback)).toHaveLength(1);
    expect(screen.queryByText("Ann")).not.toBeInTheDocument();
  });

  it("shows the chat's name from the chat list", async () => {
    seedParticipants();
    seedNoHistory();
    // The chat list is per project; the project comes from the stored session.
    upsertSession({ id: "g1", kind: "group", projectId: "p1", title: "Local title" });
    server.use(
      http.post(`${API_URL}persona/chat-list`, () =>
        ok({
          builder_chats: [],
          group_chats: [
            {
              group_id: "g1",
              project_id: "p1",
              persona_ids: ["a", "b"],
              status: "active",
              title: "Product Rating Feedback",
              created_at: null,
              updated_at: null,
            },
          ],
        }),
      ),
    );
    renderWithProviders(<GroupChatView />, { route: "/group-chat/g1" });
    expect(await screen.findByText("Product Rating Feedback")).toBeInTheDocument();
  });

  it("prompts the user when there is no history yet", async () => {
    seedParticipants();
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({ messages: [], pagination: { total: 0 } }),
      ),
    );
    renderWithProviders(<GroupChatView />);
    expect(await screen.findByText(/ask a question to hear from/i)).toBeInTheDocument();
  });

  it("broadcasts a message to everyone and reveals the reply", async () => {
    seedParticipants();
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({ messages: [], pagination: { total: 0 } }),
      ),
    );
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ndjsonStream([
          { persona_id: "a", persona_name: "Ann", response: "Go for it" },
        ]);
      }),
    );

    const { user } = renderWithProviders(<GroupChatView />);
    const textarea = await screen.findByPlaceholderText(/message everyone/i);
    await user.type(textarea, "Should we launch?{Enter}");

    expect(screen.getByText("Should we launch?")).toBeInTheDocument(); // optimistic
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ flow: "message", group_id: "g1", message: "Should we launch?" });
    expect(await screen.findByText("Go for it")).toBeInTheDocument();
  });

  it("shows a thinking status until the personas start replying", async () => {
    seedParticipants();
    seedNoHistory();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, async () => {
        await gate;
        return ndjsonStream([{ persona_id: "a", persona_name: "Ann", response: "Go for it" }]);
      }),
    );

    const { user } = renderWithProviders(<GroupChatView />);
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Launch?{Enter}");

    expect(await screen.findByText("Personas are replying")).toBeInTheDocument();
    expect(screen.getByText("Reading your question…")).toBeInTheDocument();

    release();
    expect(await screen.findByText("Go for it")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Personas are replying")).not.toBeInTheDocument(),
    );
  });

  it("names the one persona being messaged while it thinks", async () => {
    // Radix Select opens on pointer events jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    seedParticipants();
    seedNoHistory();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/group-chat/message-single/stream`, async () => {
        await gate;
        return ndjsonStream([{ persona_id: "a", persona_name: "Ann", response: "Sure" }]);
      }),
    );

    const { user } = renderWithProviders(<GroupChatView />);
    await user.click(await screen.findByRole("combobox", { name: "Choose who to message" }));
    await user.click(await screen.findByRole("option", { name: /Ann/ }));
    await user.type(await screen.findByPlaceholderText(/message ann/i), "Thoughts?{Enter}");

    expect(await screen.findByText("Ann is replying")).toBeInTheDocument();
    release();
    expect(await screen.findByText("Sure")).toBeInTheDocument();
  });

  it("drops the thinking status as soon as the first persona starts replying", async () => {
    seedParticipants();
    seedNoHistory();
    const encoder = new TextEncoder();
    const line = (event: unknown) => encoder.encode(JSON.stringify(event) + String.fromCharCode(10));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post(`${API_URL}persona/group-chat/message/stream`, () =>
        new HttpResponse(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                line({
                  type: "start",
                  personas: [
                    { persona_id: "a", persona_name: "Ann" },
                    { persona_id: "b", persona_name: "Bob" },
                  ],
                }),
              );
              controller.enqueue(line({ type: "persona_delta", persona_id: "a", delta: "Ann goes first" }));
              // Bob has not said anything yet when the test looks.
              await gate;
              controller.enqueue(
                line({
                  type: "done",
                  responses: [
                    { persona_id: "a", persona_name: "Ann", response: "Ann goes first", evidence_tags: [] },
                    { persona_id: "b", persona_name: "Bob", response: "Bob follows", evidence_tags: [] },
                  ],
                }),
              );
              controller.close();
            },
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        ),
      ),
    );

    const { user } = renderWithProviders(<GroupChatView />);
    await user.type(await screen.findByPlaceholderText(/message everyone/i), "Launch?{Enter}");

    expect(await screen.findByText("Ann goes first")).toBeInTheDocument();
    expect(screen.queryByText("Personas are replying")).not.toBeInTheDocument();

    release();
    expect(await screen.findByText("Bob follows")).toBeInTheDocument();
  });

  it("shows an error state when participants fail to load", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/participants`, () =>
        envelopeError(500, "error"),
      ),
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({ messages: [], pagination: { total: 0 } }),
      ),
    );
    renderWithProviders(<GroupChatView />);
    expect(await screen.findByText(/couldn't load this group chat/i)).toBeInTheDocument();
  });

  it("opens the assumptions dialog", async () => {
    seedParticipants();
    seedNoHistory();
    seedAssumptions([]);
    const { user } = renderWithProviders(<GroupChatView />);
    await user.click(await screen.findByRole("button", { name: /assumptions/i }));
    expect(await screen.findByText(/no assumptions yet/i)).toBeInTheDocument();
  });

  it("badges the header with the number of applied assumptions", async () => {
    seedParticipants();
    seedNoHistory();
    seedAssumptions([
      {
        assumption_id: "a1",
        text: "Product costs $34.99",
        source: "manual",
        reason: null,
        created_at: null,
      },
      {
        assumption_id: "a2",
        text: "Sold only online",
        source: "manual",
        reason: null,
        created_at: null,
      },
    ]);

    renderWithProviders(<GroupChatView />);
    const button = await screen.findByRole("button", { name: /assumptions/i });
    await waitFor(() => expect(within(button).getByText("2")).toBeInTheDocument());
  });

  it("adds a typed assumption through the dialog", async () => {
    seedParticipants();
    seedNoHistory();
    seedAssumptions([]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/group-chat/assumptions/add`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({
          status: "approved",
          assumption: {
            assumption_id: "a1",
            text: "Budget conscious shoppers",
            source: "manual",
                reason: "Fits these personas.",
            created_at: null,
          },
        });
      }),
    );

    const { user } = renderWithProviders(<GroupChatView />);
    await user.click(await screen.findByRole("button", { name: /assumptions/i }));
    await screen.findByText(/no assumptions yet/i);

    await user.type(screen.getByLabelText("New assumption"), "Budget conscious shoppers");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      group_id: "g1",
      text: "Budget conscious shoppers",
    });
  });
});

describe("GroupChatView reply", () => {
  function seedHistoryFrom(personaId: string, personaName: string) {
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({
          messages: [
            {
              user_message: "What matters?",
              responses: [{ persona_id: personaId, persona_name: personaName, response: "Affordability" }],
            },
          ],
          pagination: { total: 1 },
        }),
      ),
    );
  }

  it("addresses the next message to the persona being replied to", async () => {
    seedParticipants();
    seedHistoryFrom("b", "Bob");
    let url = "";
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}persona/group-chat/message-single/stream`, async ({ request }) => {
        url = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return ndjsonStream([{ persona_id: "b", persona_name: "Bob", response: "Still price" }]);
      }),
    );
    const { user } = renderWithProviders(<GroupChatView />);

    await user.click(await screen.findByRole("button", { name: "Reply to Bob" }));

    const input = screen.getByPlaceholderText("Message Bob…");
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, "Why?{Enter}");

    expect(await screen.findByText("Still price")).toBeInTheDocument();
    expect(url).toContain("message-single/stream");
    expect(body).toMatchObject({ group_id: "g1", persona_id: "b", message: "Why?" });
  });

  it("keeps the draft when switching the recipient", async () => {
    seedParticipants();
    seedHistoryFrom("a", "Ann");
    const { user } = renderWithProviders(<GroupChatView />);
    const input = await screen.findByPlaceholderText(/message everyone/i);
    await user.type(input, "Half-written");

    await user.click(await screen.findByRole("button", { name: "Reply to Ann" }));

    expect(screen.getByPlaceholderText("Message Ann…")).toHaveValue("Half-written");
  });

  it("offers no Reply for a persona who is no longer in the group", async () => {
    seedParticipants();
    seedHistoryFrom("gone", "Gina");
    renderWithProviders(<GroupChatView />);

    expect(await screen.findByText("Affordability")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply to/i })).not.toBeInTheDocument();
  });

  it("offers no Reply for a participant marked inactive", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/participants`, () =>
        ok({ participants: [{ persona_id: "a", persona_name: "Ann", color: "green", active: false }] }),
      ),
    );
    seedHistoryFrom("a", "Ann");
    renderWithProviders(<GroupChatView />);

    expect(await screen.findByText("Affordability")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply to/i })).not.toBeInTheDocument();
  });
});

describe("GroupChatView streaming failures", () => {
  const STREAM = `${API_URL}persona/group-chat/message/stream`;
  const start = {
    type: "start",
    personas: [
      { persona_id: "a", persona_name: "Ann" },
      { persona_id: "b", persona_name: "Bob" },
    ],
  };

  async function sendQuestion(text = "Launch?") {
    const { user } = renderWithProviders(<GroupChatView />);
    await user.type(await screen.findByPlaceholderText(/message everyone/i), `${text}{Enter}`);
    return user;
  }

  beforeEach(() => {
    seedParticipants();
    seedNoHistory();
    vi.mocked(toast.error).mockClear();
  });

  it("drops partial replies when the server fails the turn", async () => {
    server.use(
      http.post(STREAM, () =>
        ndjsonBody([
          start,
          { type: "persona_delta", persona_id: "a", delta: "Half an ans" },
          { type: "error", message: "Failed to generate persona responses" },
        ]),
      ),
    );
    await sendQuestion();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to generate persona responses"),
    );
    // The failed turn was not saved, so none of its text stays on screen...
    await waitFor(() => expect(screen.queryByText(/half an ans/i)).not.toBeInTheDocument());
    // ...but the user's own message does, as with the buffered endpoints.
    expect(screen.getByText("Launch?")).toBeInTheDocument();
  });

  it("keeps finished replies when the connection drops mid-turn", async () => {
    server.use(
      http.post(STREAM, () =>
        ndjsonBody([
          start,
          { type: "persona_delta", persona_id: "a", delta: "Ann's full answer" },
          { type: "persona_done", persona_id: "a" },
          { type: "persona_delta", persona_id: "b", delta: "Bob was cut o" },
          // No `done`: the body just ends.
        ]),
      ),
    );
    await sendQuestion();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/still being saved/i)),
    );
    expect(screen.getByText("Ann's full answer")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/bob was cut o/i)).not.toBeInTheDocument());
  });

  it("marks the chat ended when the server says so", async () => {
    server.use(http.post(STREAM, () => envelopeError(400, "Group chat has already ended")));
    await sendQuestion();

    expect(await screen.findByText(/this discussion has ended/i)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Group chat has already ended");
  });

  it("stops offering Reply once the chat has ended", async () => {
    server.use(
      http.post(`${API_URL}persona/group-chat/history`, () =>
        ok({
          messages: [
            {
              user_message: "Earlier?",
              responses: [{ persona_id: "a", persona_name: "Ann", response: "Earlier answer" }],
            },
          ],
          pagination: { total: 1 },
        }),
      ),
      http.post(STREAM, () => envelopeError(400, "Group chat has already ended")),
    );
    const { user } = renderWithProviders(<GroupChatView />);
    expect(await screen.findByRole("button", { name: "Reply to Ann" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/message everyone/i), "Launch?{Enter}");

    expect(await screen.findByText(/this discussion has ended/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply to Ann" })).not.toBeInTheDocument();
  });

  it("shows the saved text when it differs from what streamed", async () => {
    server.use(
      http.post(STREAM, () =>
        ndjsonBody([
          start,
          { type: "persona_delta", persona_id: "a", delta: "Draft wording" },
          { type: "persona_done", persona_id: "a" },
          {
            type: "done",
            responses: [
              { persona_id: "a", persona_name: "Ann", response: "Final wording", evidence_tags: [] },
              { persona_id: "b", persona_name: "Bob", response: "Bob never streamed", evidence_tags: [] },
            ],
          },
        ]),
      ),
    );
    await sendQuestion();

    expect(await screen.findByText("Final wording")).toBeInTheDocument();
    expect(screen.queryByText("Draft wording")).not.toBeInTheDocument();
    // A saved reply that sent no deltas still gets its bubble.
    expect(screen.getByText("Bob never streamed")).toBeInTheDocument();
  });
});
