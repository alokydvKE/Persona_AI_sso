import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import {
  usePersonaList,
  usePersonaDashboard,
  usePersonaBuildJob,
} from "./query";

beforeEach(() => authenticate());

describe("usePersonaList", () => {
  it("fetches active personas for a project", async () => {
    server.use(
      http.post(`${API_URL}persona/list`, () =>
        ok({ personas: [{ persona_id: "x1" }, { persona_id: "x2" }] }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaList("p1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.personas).toHaveLength(2);
  });

  it("is disabled without a projectId", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaList(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("usePersonaDashboard", () => {
  it("returns the aggregate summary and personas", async () => {
    server.use(
      http.post(`${API_URL}persona/dashboard`, () =>
        ok({
          summary: {
            personas_created: 3,
            insufficient_data: 0,
            data_files: 2,
            unique_studies: 4,
            unique_respondents: 120,
          },
          personas: [],
        }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaDashboard("p1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary.personas_created).toBe(3);
  });
});

describe("usePersonaBuildJob", () => {
  it("polls and returns a job once a jobId is provided", async () => {
    server.use(
      http.post(`${API_URL}projects/job-status`, () =>
        ok({ job_id: "j1", status: "done", progress: 100, result: null }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaBuildJob("j1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("done");
  });

  it("is disabled without a jobId", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaBuildJob(null), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
