import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import AssumptionsDialog from "../../../../components/common/Chat/GroupChat/AssumptionsDialog";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const LIST = `${API_URL}persona/group-chat/assumptions/list`;
const SUGGEST = `${API_URL}persona/group-chat/assumptions/suggest`;
const ADD = `${API_URL}persona/group-chat/assumptions/add`;
const REMOVE = `${API_URL}persona/group-chat/assumptions/remove`;

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  groupId: "g1",
};

function assumption(overrides: Partial<GroupAssumption> = {}): GroupAssumption {
  return {
    assumption_id: "a1",
    text: "Product costs $34.99 for a 12 lb bag",
    source: "manual",
    reason: "On-topic for this category.",
    created_at: null,
    ...overrides,
  };
}

/** A proposal from /suggest — no id, but carrying its signature. */
function suggestion(
  overrides: Partial<AssumptionSuggestion> = {},
): AssumptionSuggestion {
  return {
    text: "The packaging carries a natural-ingredients claim",
    reason: "Fits this category.",
    token: "sig-default",
    ...overrides,
  };
}

/** Seed the applied list. */
function seedList(assumptions: GroupAssumption[] = [], maxAllowed = 20) {
  server.use(
    http.post(LIST, () =>
      ok({ assumptions, count: assumptions.length, max_allowed: maxAllowed }),
    ),
  );
}

beforeEach(() => {
  authenticate();
  seedList([]);
});

describe("AssumptionsDialog", () => {
  it("does not render when closed", () => {
    renderWithProviders(<AssumptionsDialog {...baseProps} open={false} />);
    expect(screen.queryByText("Assumptions")).not.toBeInTheDocument();
  });

  it("renders the applied assumptions from the server", async () => {
    seedList([
      assumption(),
      assumption({ assumption_id: "a2", text: "Sold only online", reason: null }),
    ]);
    renderWithProviders(<AssumptionsDialog {...baseProps} />);

    expect(
      await screen.findByText("Product costs $34.99 for a 12 lb bag"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sold only online")).toBeInTheDocument();
    expect(screen.getByText("2 of 20")).toBeInTheDocument();
    // The verdict's reason comes back on every applied row and is deliberately
    // not rendered — it explains a decision the user did not have to make.
    expect(
      screen.queryByText("On-topic for this category."),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is applied", async () => {
    renderWithProviders(<AssumptionsDialog {...baseProps} />);
    expect(await screen.findByText(/no assumptions yet/i)).toBeInTheDocument();
  });

  it("fetches and lists suggestions", async () => {
    server.use(
      http.post(SUGGEST, () => ok({ suggestions: [suggestion()] })),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    expect(
      await screen.findByText("The packaging carries a natural-ingredients claim"),
    ).toBeInTheDocument();
    // Only the statement is offered; why the model likes it is not shown.
    expect(screen.queryByText("Fits this category.")).not.toBeInTheDocument();
  });

  it("keeps every suggestion in a scroller rather than truncating the list", async () => {
    // The strip is two rows tall; the rest are reached by scrolling. jsdom does
    // no layout, so what is worth asserting is that nothing is dropped — this
    // fails if someone caps the height by slicing the array instead.
    server.use(
      http.post(SUGGEST, () =>
        ok({
          suggestions: [1, 2, 3, 4].map((n) =>
            suggestion({ text: `Suggestion number ${n}`, token: `sig-${n}` }),
          ),
        }),
      ),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    expect(await screen.findByText("Suggestion number 1")).toBeInTheDocument();
    expect(screen.getByText("Suggestion number 4")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /apply assumption:/i }),
    ).toHaveLength(4);
  });

  it("applies a suggestion with its signature, so it skips validation", async () => {
    server.use(
      http.post(SUGGEST, () =>
        ok({
          suggestions: [suggestion({ text: "Sold in 12-packs", token: "sig-abc" })],
        }),
      ),
    );
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(ADD, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ status: "approved", assumption: assumption({ text: "Sold in 12-packs" }) });
      }),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    await user.click(
      await screen.findByRole("button", { name: /apply assumption: Sold in 12-packs/i }),
    );

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.text).toBe("Sold in 12-packs");
    expect(body!.suggestion_token).toBe("sig-abc");
    // The applied one leaves the suggestion strip.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /apply assumption: Sold in 12-packs/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("replaces the strip when asking for more, and carries nothing forward", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(SUGGEST, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const n = bodies.length;
        return ok({ suggestions: [suggestion({ text: `Round ${n} idea` })] });
      }),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    await screen.findByText("Round 1 idea");
    await user.click(screen.getByRole("button", { name: /suggest more/i }));
    await screen.findByText("Round 2 idea");

    // Each round replaces the last, and no exclusion state is sent.
    expect(screen.queryByText("Round 1 idea")).not.toBeInTheDocument();
    expect(bodies[0].exclude).toBeUndefined();
    expect(bodies[1].exclude).toBeUndefined();
  });

  it("keeps the suggestions when the dialog is closed and reopened", async () => {
    let calls = 0;
    server.use(
      http.post(SUGGEST, () => {
        calls += 1;
        return ok({ suggestions: [suggestion({ text: "Sold in 12-packs" })] });
      }),
    );
    const { user, rerender } = renderWithProviders(
      <AssumptionsDialog {...baseProps} />,
    );
    await screen.findByText(/no assumptions yet/i);
    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    await screen.findByText("Sold in 12-packs");

    rerender(<AssumptionsDialog {...baseProps} open={false} />);
    rerender(<AssumptionsDialog {...baseProps} open />);

    // Still on offer, and no second LLM call was needed to get them back —
    // closing the dialog by accident must not cost a round trip.
    expect(await screen.findByText("Sold in 12-packs")).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(
      screen.getByRole("button", { name: /suggest more/i }),
    ).toBeInTheDocument();
  });

  it("does not carry one group's suggestions into another", async () => {
    server.use(
      http.post(SUGGEST, () =>
        ok({ suggestions: [suggestion({ text: "Group one idea" })] }),
      ),
    );
    const { user, rerender } = renderWithProviders(
      <AssumptionsDialog {...baseProps} />,
    );
    await screen.findByText(/no assumptions yet/i);
    await user.click(screen.getByRole("button", { name: /^suggest$/i }));
    await screen.findByText("Group one idea");

    rerender(<AssumptionsDialog {...baseProps} groupId="g2" />);

    // They are held per group, so switching chats starts from nothing rather
    // than offering ideas written for a different set of personas.
    await waitFor(() =>
      expect(screen.queryByText("Group one idea")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /^suggest$/i })).toBeInTheDocument();
  });

  it("submits typed text for validation and clears the box when approved", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(ADD, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ status: "approved", assumption: assumption() });
      }),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    const input = screen.getByLabelText("New assumption");
    await user.type(input, "Product costs $34.99");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.text).toBe("Product costs $34.99");
    // No signature: the server must validate this like any other user input.
    expect(body!.suggestion_token).toBeUndefined();
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("shows the reason and the offered rewrite when rejected", async () => {
    server.use(
      http.post(ADD, () =>
        ok({
          status: "rejected",
          text: "the moon is cheese",
          reason: "Off-topic for these personas.",
          suggested_assumption: "The product is sold in a resealable bag.",
          suggested_token: "sig-rewrite",
        }),
      ),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.type(screen.getByLabelText("New assumption"), "the moon is cheese");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText(/wasn't applied/i)).toBeInTheDocument();
    expect(screen.getByText("Off-topic for these personas.")).toBeInTheDocument();
    expect(
      screen.getByText("The product is sold in a resealable bag."),
    ).toBeInTheDocument();
    // Rejected text must never show up as applied.
    expect(screen.getByText(/no assumptions yet/i)).toBeInTheDocument();
  });

  it("accepts the offered rewrite, referencing the rejected entry", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(ADD, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        if (bodies.length === 1) {
          return ok({
            status: "rejected",
            text: "the moon is cheese",
            reason: "Off-topic.",
            suggested_assumption: "The product is sold in a resealable bag.",
            suggested_token: "sig-rewrite",
          });
        }
        return ok({ status: "approved", assumption: assumption() });
      }),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.type(screen.getByLabelText("New assumption"), "the moon is cheese");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await screen.findByText(/wasn't applied/i);

    await user.click(screen.getByRole("button", { name: /use this instead/i }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].text).toBe("The product is sold in a resealable bag.");
    expect(bodies[1].suggestion_token).toBe("sig-rewrite");
    // The callout clears once the replacement is applied.
    await waitFor(() =>
      expect(screen.queryByText(/wasn't applied/i)).not.toBeInTheDocument(),
    );
  });

  it("dismisses a rejection without applying anything", async () => {
    server.use(
      http.post(ADD, () =>
        ok({
          status: "rejected",
          text: "bad",
          reason: "Off-topic.",
          suggested_assumption: null,
          suggested_token: null,
        }),
      ),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);

    await user.type(screen.getByLabelText("New assumption"), "bad input");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await screen.findByText(/wasn't applied/i);
    // No replacement offered -> no "use this instead" affordance.
    expect(
      screen.queryByRole("button", { name: /use this instead/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/wasn't applied/i)).not.toBeInTheDocument();
  });

  it("removes an applied assumption by id", async () => {
    seedList([assumption({ assumption_id: "a1", text: "Sold only online" })]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(REMOVE, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ assumption_id: "a1" });
      }),
    );
    const { user } = renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText("Sold only online");

    await user.click(
      screen.getByRole("button", { name: /remove assumption: Sold only online/i }),
    );
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.assumption_id).toBe("a1");
  });

  it("blocks adding once the cap is reached", async () => {
    seedList([assumption()], 1);
    renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText("1 of 1");

    expect(screen.getByLabelText("New assumption")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^suggest$/i })).toBeDisabled();
    expect(screen.getByText(/reached the maximum/i)).toBeInTheDocument();
  });

  it("does not submit an empty draft", async () => {
    renderWithProviders(<AssumptionsDialog {...baseProps} />);
    await screen.findByText(/no assumptions yet/i);
    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
  });

  it("closes via Done", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <AssumptionsDialog {...baseProps} onOpenChange={onOpenChange} />,
    );
    await screen.findByText(/no assumptions yet/i);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
