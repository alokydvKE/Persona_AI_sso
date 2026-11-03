import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, envelopeError, dataSourceOptions } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import DataSourceControl from "@/components/common/Chat/DataSourceControl";
import type { DataSourceKey } from "@/api/Chat/query";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => authenticate());

type HarnessProps = {
  value?: DataSourceKey | null;
  selected?: boolean;
  locked?: boolean;
  onChanged?: (next: DataSourceKey) => void;
};

/**
 * The dialog is controlled by the chat view (so the composer's prompt can open
 * it too), so tests need something to hold that state. This mirrors what
 * ConversationPromptInput does.
 */
function Harness({
  value = "master",
  selected = true,
  locked = false,
  onChanged = vi.fn(),
}: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <DataSourceControl
      conversationId="c1"
      projectId="p1"
      value={value}
      selected={selected}
      locked={locked}
      onChanged={onChanged}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

const allAvailable = () =>
  server.use(
    http.post(`${API_URL}persona/chat/data-sources`, () =>
      ok(dataSourceOptions({ allAvailable: true })),
    ),
  );

describe("DataSourceControl", () => {
  it("shows which dataset the chat builds from", () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole("button", { name: /master data/i })).toBeInTheDocument();
  });

  it("asks for a choice while the chat has none", () => {
    renderWithProviders(<Harness selected={false} />);
    // Not "Master data": the chat would build from it, but nobody chose it, and
    // the composer is locked until someone does.
    expect(
      screen.getByRole("button", { name: /select data source/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^master data$/i })).toBeNull();
  });

  it("stays visible but inert once the build has started", async () => {
    const { user } = renderWithProviders(
      <Harness value="combined" locked />,
    );

    const chip = screen.getByRole("button", { name: /master \+ my uploaded data/i });
    expect(chip).toHaveAttribute("aria-disabled", "true");

    await user.click(chip);
    // No dialog: the worker already has the key, so there is nothing to change.
    expect(screen.queryByText(/data source/i, { selector: "h2" })).toBeNull();
  });

  it("saves the first choice even when it matches the default", async () => {
    let body: Record<string, unknown> | undefined;
    allAvailable();
    server.use(
      http.post(`${API_URL}persona/chat/data-source`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ conversation_id: "c1", data_source: "master" });
      }),
    );
    const onChanged = vi.fn();
    const { user } = renderWithProviders(
      <Harness selected={false} onChanged={onChanged} />,
    );

    await user.click(screen.getByRole("button", { name: /select data source/i }));
    await user.click(await screen.findByRole("radio", { name: /^master data/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    // Picking master must still reach the server: that write is what turns
    // "would build from master" into "chose master" and unlocks the composer.
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("master"));
    expect(body).toMatchObject({ conversation_id: "c1", data_source: "master" });
  });

  it("saves a new source and reports it back", async () => {
    let body: Record<string, unknown> | undefined;
    allAvailable();
    server.use(
      http.post(`${API_URL}persona/chat/data-source`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ conversation_id: "c1", data_source: "uploaded" });
      }),
    );
    const onChanged = vi.fn();
    const { user } = renderWithProviders(<Harness onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /master data/i }));
    await user.click(await screen.findByRole("radio", { name: /^my uploaded data/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("uploaded"));
    expect(body).toMatchObject({ conversation_id: "c1", data_source: "uploaded" });
  });

  it("cancelling leaves the pinned source alone", async () => {
    let called = false;
    allAvailable();
    server.use(
      http.post(`${API_URL}persona/chat/data-source`, () => {
        called = true;
        return ok({ conversation_id: "c1", data_source: "uploaded" });
      }),
    );
    const onChanged = vi.fn();
    const { user } = renderWithProviders(<Harness onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /master data/i }));
    await user.click(await screen.findByRole("radio", { name: /^my uploaded data/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(called).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();

    // Reopening starts from what is actually pinned, not the abandoned draft.
    await user.click(screen.getByRole("button", { name: /master data/i }));
    expect(await screen.findByRole("radio", { name: /^master data/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("keeps the current source when the backend refuses the change", async () => {
    allAvailable();
    server.use(
      // 409: the build was dispatched between opening the dialog and confirming.
      http.post(`${API_URL}persona/chat/data-source`, () =>
        envelopeError(409, "This build has already started"),
      ),
    );
    const onChanged = vi.fn();
    const { user } = renderWithProviders(<Harness onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /master data/i }));
    await user.click(await screen.findByRole("radio", { name: /^my uploaded data/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    // The dialog stays open on failure (nothing was saved), so the chip behind it
    // is still hidden from the a11y tree — close it, then check what it reports.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^confirm$/i })).toBeEnabled(),
    );
    expect(onChanged).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(
      await screen.findByRole("button", { name: /master data/i }),
    ).toBeInTheDocument();
  });
});
