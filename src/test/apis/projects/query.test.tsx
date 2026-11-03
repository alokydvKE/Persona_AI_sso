import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate, makeProject } from "@/test/factories";
import { getProjectList, useProjectDetail, PROJECTS_PAGE_SIZE } from "@/api/Projects/query";

beforeEach(() => authenticate());

describe("getProjectList", () => {
  it("fetches and returns the paginated project list", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => getProjectList(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The hook returns the full envelope; projects live under `.response`.
    expect(result.current.data?.response.projects).toHaveLength(2);
  });

  it("sends search, offset and limit in the request payload", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}projects/list`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ projects: [], pagination: { total: 0 } });
      }),
    );
    const { Wrapper } = createHookWrapper();
    renderHook(() => getProjectList("query", 20, PROJECTS_PAGE_SIZE), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(body.search).toBe("query"));
    expect(body).toMatchObject({ search: "query", offset: 20, limit: 10 });
  });

  it("stays disabled for 1-2 character searches (no request fired)", async () => {
    const spy = vi.fn();
    server.use(
      http.post(`${API_URL}projects/list`, () => {
        spy();
        return ok({ projects: [], pagination: { total: 0 } });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => getProjectList("ab"), {
      wrapper: Wrapper,
    });

    // The query is disabled, so it is never fetching and never calls the API.
    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });

  it("is disabled when there is no auth token", async () => {
    localStorage.clear();
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => getProjectList(), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useProjectDetail", () => {
  it("returns the unwrapped project when a projectId is supplied", async () => {
    server.use(
      http.post(`${API_URL}projects/get`, () =>
        ok(makeProject({ project_id: "p42", project_name: "Detailed" })),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useProjectDetail("p42"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.project_name).toBe("Detailed");
  });

  it("is disabled when no projectId is provided", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useProjectDetail(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
