import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http } from "msw";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { createHookWrapper } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { usePersonaGenerate, usePersonaUpdate } from "./mutation";

beforeEach(() => authenticate());

describe("usePersonaGenerate", () => {
  it("generates personas for a project", async () => {
    server.use(
      http.post(`${API_URL}persona/generate`, () =>
        ok({ job_id: "j1", status: "done", personas: ["p-a", "p-b"] }),
      ),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaGenerate(), { wrapper: Wrapper });

    act(() => result.current.mutate({ projectId: "p1" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.personas).toEqual(["p-a", "p-b"]);
  });
});

describe("usePersonaUpdate", () => {
  it("renames a persona, sending id and new name", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_URL}persona/update`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({});
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => usePersonaUpdate("p1"), {
      wrapper: Wrapper,
    });

    act(() =>
      result.current.mutate({ personaId: "x1", personaName: "New Name" }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toMatchObject({ persona_id: "x1", persona_name: "New Name" });
  });
});
