import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router";
import { http } from "msw";

import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok, dataStateResponse } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import UploadPage from "@/pages/Upload";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/**
 * Stands in for the chat entry, and reports the one thing about the handoff that
 * matters: `fromUpload` tells ChatEntry not to route back into the step the user
 * just left, so a handoff without it can bounce straight back here.
 */
function ChatStub() {
  const { state } = useLocation();
  const fromUpload = (state as { fromUpload?: boolean } | null)?.fromUpload;
  return (
    <p data-testid="chat">
      {fromUpload ? "Persona builder (from upload)" : "Persona builder"}
    </p>
  );
}

/** Render the page at /upload/p1, with a stub for wherever it might divert to. */
const renderUpload = () =>
  renderWithProviders(
    <Routes>
      <Route path="/upload/:projectId" element={<UploadPage />} />
      <Route path="/chat" element={<ChatStub />} />
      <Route path="/dashboard" element={<p>Dashboard</p>} />
    </Routes>,
    { routerEntries: ["/upload/p1"] as never },
  );

const withState = (over: Parameters<typeof dataStateResponse>[0]) =>
  server.use(
    http.post(`${API_URL}projects/data-state`, () => ok(dataStateResponse(over))),
  );

/** A pipeline job as /job-status reports it. */
const job = (over: Record<string, unknown> = {}) => ({
  job_id: "job-1",
  job_type: "file_pipeline",
  status: "running",
  progress: 40,
  result: null,
  steps: [
    { key: "cleaning", label: "Cleaning your data", status: "done", done: 1, failed: 0, total: 1 },
    { key: "classification", label: "Classifying questions", status: "running", done: 0, failed: 0, total: 1 },
  ],
  ...over,
});

beforeEach(() => authenticate());

describe("UploadPage", () => {
  it("offers the dropzone while the project is still in setup", async () => {
    withState({ upload_allowed: true, locked_reason: null });
    renderUpload();

    expect(
      await screen.findByText(/drop files here or click to browse/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip for now/i })).toBeInTheDocument();
  });

  it("sends the user to the chat once the project has been started", async () => {
    // Covers a bookmark, a refresh, and a second tab: the upload step is over,
    // and re-running the pipeline would archive the data already built on.
    withState({ upload_allowed: false, locked_reason: "chat_started" });
    renderUpload();

    expect(await screen.findByText("Persona builder")).toBeInTheDocument();
  });

  it("resumes a run that was still going when the tab was closed", async () => {
    withState({ upload_allowed: true, locked_reason: null, active_job: job() });
    server.use(http.post(`${API_URL}projects/job-status`, () => ok(job())));
    renderUpload();

    // Straight into progress — no dropzone, which would invite a second run
    // that the backend would refuse anyway.
    expect(await screen.findByText(/still processing your data/i)).toBeInTheDocument();
    expect(screen.queryByText(/drop files here/i)).toBeNull();
    // The bar is indeterminate until the first poll lands, then reports the
    // real percentage the job left off at.
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40"),
    );
  });

  it("surfaces a run that failed while nobody was watching", async () => {
    withState({
      upload_allowed: true,
      locked_reason: null,
      last_failed_job: {
        job_id: "job-0",
        error: {
          error_code: "pipeline_stalled",
          message: "Processing timed out and was stopped. Please try uploading again.",
          retryable: true,
        },
      },
    });
    renderUpload();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /processing timed out/i,
    );
    // And the user can act on it: the dropzone is right there, not behind a retry.
    expect(screen.getByText(/drop files here or click to browse/i)).toBeInTheDocument();
  });

  it("flags the skip so the chat entry does not send it straight back", async () => {
    withState({ upload_allowed: true, locked_reason: null });
    const { user } = renderUpload();

    await user.click(await screen.findByRole("button", { name: /skip for now/i }));
    expect(await screen.findByTestId("chat")).toHaveTextContent(
      "Persona builder (from upload)",
    );
  });

  it("moves on to the chat when the pipeline finishes", async () => {
    // The regression: processing completed and the page just sat there. The
    // handoff carries the same flag the skip does, so it cannot be bounced back
    // by a state read that has not caught up with the run that just ended.
    withState({ upload_allowed: true, locked_reason: null, active_job: job() });
    server.use(
      http.post(`${API_URL}projects/job-status`, () =>
        ok(job({ status: "done", progress: 100 })),
      ),
    );
    renderUpload();

    expect(await screen.findByTestId("chat")).toHaveTextContent(
      "Persona builder (from upload)",
    );
  });

  it("shows a loader rather than guessing while the state is unknown", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post(`${API_URL}projects/data-state`, async () => {
        await gate;
        return ok(dataStateResponse({ upload_allowed: true, locked_reason: null }));
      }),
    );
    renderUpload();

    // Neither the dropzone nor a redirect until the answer lands — showing the
    // dropzone early would let a user start a second run over a live one.
    expect(await screen.findByText(/loading project/i)).toBeInTheDocument();
    expect(screen.queryByText(/drop files here/i)).toBeNull();

    release?.();
    await waitFor(() =>
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument(),
    );
  });
});
