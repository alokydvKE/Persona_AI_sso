import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import GroupChatPage from "../../pages/GroupChat";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

describe("GroupChatPage", () => {
  // With no :groupId param the view has no group to load and shows its prompt.
  it("renders the group chat view", () => {
    renderWithProviders(<GroupChatPage />);
    expect(screen.getByText(/ask a question to hear from/i)).toBeInTheDocument();
  });
});
