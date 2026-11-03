import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import PersonaBuildProgress from "../../../../components/common/Chat/PersonaBuildProgress";

beforeEach(() => authenticate());

const jobStatus = (over: Record<string, unknown>) =>
  server.use(
    http.post(`${API_URL}projects/job-status`, () =>
      ok({ job_id: "j1", status: "running", progress: 0, result: null, ...over }),
    ),
  );

describe("PersonaBuildProgress", () => {
  it("shows the building state while the job runs", async () => {
    jobStatus({ status: "running" });
    renderWithProviders(
      <PersonaBuildProgress jobId="j1" onComplete={vi.fn()} />,
    );
    expect(await screen.findByText(/building your personas/i)).toBeInTheDocument();
  });

  it("renders the per-step stepper with persona counts when steps are present", async () => {
    jobStatus({
      status: "running",
      progress: 22,
      steps: [
        { key: "demographic_profiling", label: "Analyzing demographics", status: "done", done: 3, failed: 0, total: 3 },
        { key: "respondent_matching", label: "Matching respondents", status: "running", done: 2, failed: 0, total: 3 },
        { key: "evidence_labels", label: "Generating evidence highlights", status: "pending", done: 0, failed: 0, total: 3 },
      ],
    });
    renderWithProviders(
      <PersonaBuildProgress jobId="j1" onComplete={vi.fn()} />,
    );
    expect(await screen.findByText("Analyzing demographics")).toBeInTheDocument();
    expect(screen.getByText("Matching respondents")).toBeInTheDocument();
    expect(screen.getByText("Generating evidence highlights")).toBeInTheDocument();
    // Per-step "done / total personas" badge for the in-flight step.
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("calls onComplete once when the job is done", async () => {
    jobStatus({ status: "done", progress: 100, result: { personas: [] } });
    const onComplete = vi.fn();
    renderWithProviders(
      <PersonaBuildProgress jobId="j1" onComplete={onComplete} />,
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("shows the failed state and calls onError", async () => {
    jobStatus({ status: "failed" });
    const onError = vi.fn();
    renderWithProviders(
      <PersonaBuildProgress jobId="j1" onComplete={vi.fn()} onError={onError} />,
    );
    expect(await screen.findByText(/couldn't build your personas/i)).toBeInTheDocument();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it("offers a View personas anyway action on failure", async () => {
    jobStatus({ status: "failed" });
    const onViewPersonas = vi.fn();
    const { user } = renderWithProviders(
      <PersonaBuildProgress
        jobId="j1"
        onComplete={vi.fn()}
        onError={vi.fn()}
        onViewPersonas={onViewPersonas}
      />,
    );
    await user.click(await screen.findByRole("button", { name: /view personas anyway/i }));
    expect(onViewPersonas).toHaveBeenCalled();
  });

  it("pops each check in and glows once when the build finishes on screen", async () => {
    const step = (status: string, done: number) => ({
      key: "matching", label: "Matching respondents", status, done, failed: 0, total: 2,
    });
    let calls = 0;
    server.use(
      http.post(`${API_URL}projects/job-status`, () => {
        calls += 1;
        return calls === 1
          ? ok({ job_id: "j1", status: "running", progress: 50, result: null, steps: [step("running", 1)] })
          : ok({ job_id: "j1", status: "done", progress: 100, result: { personas: [] }, steps: [step("done", 2)] });
      }),
    );
    renderWithProviders(<PersonaBuildProgress jobId="j1" />);

    expect(await screen.findByText(/building your personas/i)).toBeInTheDocument();
    expect(await screen.findByText("Personas built", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(document.querySelector("[data-popped]")).not.toBeNull();
    expect(document.querySelector("[data-celebrate]")).not.toBeNull();
  });

  it("shows a build that was already done without replaying it", async () => {
    const snapshot = {
      job_id: "j1",
      status: "done" as const,
      progress: 100,
      steps: [{ key: "matching", label: "Matching respondents", status: "done" as const, done: 2, failed: 0, total: 2 }],
    };
    renderWithProviders(<PersonaBuildProgress jobId="j1" snapshot={snapshot} />);

    expect(await screen.findByText("Personas built")).toBeInTheDocument();
    expect(document.querySelector("[data-popped]")).toBeNull();
    expect(document.querySelector("[data-celebrate]")).toBeNull();
  });

  it("toggles the build results panel once the build is done", async () => {
    jobStatus({ status: "done", progress: 100, result: { personas: [] } });
    const onToggleResults = vi.fn();
    const { user, rerender } = renderWithProviders(
      <PersonaBuildProgress jobId="j1" onToggleResults={onToggleResults} />,
    );

    const open = await screen.findByRole("button", { name: "View build results" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);
    expect(onToggleResults).toHaveBeenCalledTimes(1);

    rerender(<PersonaBuildProgress jobId="j1" resultsOpen onToggleResults={onToggleResults} />);
    expect(screen.getByRole("button", { name: "Hide build results" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("offers the results panel for a failed build too", async () => {
    jobStatus({ status: "failed" });
    renderWithProviders(<PersonaBuildProgress jobId="j1" onToggleResults={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "View build results" })).toBeInTheDocument();
  });

  it("doesn't offer the results panel while the build runs", async () => {
    jobStatus({ status: "running" });
    renderWithProviders(<PersonaBuildProgress jobId="j1" onToggleResults={vi.fn()} />);
    await screen.findByText(/building your personas/i);
    expect(screen.queryByRole("button", { name: /build results/i })).not.toBeInTheDocument();
  });
});
