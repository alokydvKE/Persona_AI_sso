import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate } from "@/test/factories";
import { RenameChatDialog } from "@/components/common/Chat/RenameChatDialog";
import type { RecentChat } from "@/api/Chat/query";

const chat: RecentChat = {
  id: "b1",
  kind: "builder",
  to: "/chat/b1",
  projectId: "p1",
  title: "Persona chat",
  hasServerTitle: true,
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => authenticate());

describe("RenameChatDialog", () => {
  it("prefills the current title and submits a trimmed new one", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}persona/chat/rename`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({});
      }),
    );
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <RenameChatDialog chat={chat} onClose={onClose} />,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Persona chat");

    await user.clear(input);
    await user.type(input, "  Low-sugar hydration  ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({
      chat_id: "b1",
      chat_type: "builder",
      title: "Low-sugar hydration", // surrounding whitespace trimmed
    });
  });

  it("sends the group chat_type for a group chat", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}persona/chat/rename`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({});
      }),
    );
    const onClose = vi.fn();
    const groupChat: RecentChat = { ...chat, id: "g1", kind: "group" };
    const { user } = renderWithProviders(
      <RenameChatDialog chat={groupChat} onClose={onClose} />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Design crit");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ chat_id: "g1", chat_type: "group" });
  });

  it("blocks a blank title and never calls the endpoint", async () => {
    const hit = vi.fn();
    server.use(
      http.post(`${API_URL}persona/chat/rename`, () => {
        hit();
        return ok({});
      }),
    );
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <RenameChatDialog chat={chat} onClose={onClose} />,
    );

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("Please enter a chat name"),
    ).toBeInTheDocument();
    expect(hit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without a request when the title is unchanged", async () => {
    const hit = vi.fn();
    server.use(
      http.post(`${API_URL}persona/chat/rename`, () => {
        hit();
        return ok({});
      }),
    );
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <RenameChatDialog chat={chat} onClose={onClose} />,
    );

    // Submit with the prefilled title untouched.
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(hit).not.toHaveBeenCalled();
  });
});
