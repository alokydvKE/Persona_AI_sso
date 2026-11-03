import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import GroupMessage from "../../../../components/common/Chat/GroupChat/GroupMessage";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const userTurn = { role: "user", message: "What do you think?" };
const personaTurn = {
  role: "persona",
  message: "I'd prioritise affordability.",
  persona_name: "Ann Lee",
  evidence_tags: ["price-sensitive", "value-seeker"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (props: any) => renderWithProviders(<GroupMessage {...props} />);

describe("GroupMessage", () => {
  it("renders a user turn as a right-aligned bubble", () => {
    render({ message: userTurn });
    expect(screen.getByText("What do you think?")).toBeInTheDocument();
  });

  it("renders a persona turn with name, initials and evidence tags", () => {
    render({ message: personaTurn, color: "green" });
    expect(screen.getByText("Ann Lee")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument(); // initials
    expect(screen.getByText("price-sensitive")).toBeInTheDocument();
    expect(screen.getByText("value-seeker")).toBeInTheDocument();
  });

  it("invokes onEdit with the user message text", async () => {
    const onEdit = vi.fn();
    const { user } = render({ message: userTurn, onEdit });
    await user.click(screen.getAllByRole("button")[0]); // Edit is first
    expect(onEdit).toHaveBeenCalledWith("What do you think?");
  });

  it("does not show an edit action on persona turns", () => {
    render({ message: personaTurn, onEdit: vi.fn() });
    // Persona bubble only exposes the Copy action.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders a persona turn without evidence tags", () => {
    render({
      message: { role: "persona", message: "Plain reply", persona_name: "Cara" },
      color: "red",
    });
    expect(screen.getByText("Cara")).toBeInTheDocument();
    expect(screen.getByText("Plain reply")).toBeInTheDocument();
    expect(screen.queryByText("price-sensitive")).not.toBeInTheDocument();
  });

  it("renders a user turn without an edit action when onEdit is omitted", () => {
    render({ message: userTurn });
    // Only the Copy action is present.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("copies the persona reply to the clipboard", async () => {
    const writeSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const { user } = render({ message: personaTurn, color: "green" });
    await user.click(screen.getByRole("button")); // persona turn: only Copy
    expect(writeSpy).toHaveBeenCalledWith("I'd prioritise affordability.");
  });

  it("offers Reply on a persona turn and passes the message back", async () => {
    const onReply = vi.fn();
    const message = { id: "m1", persona_id: "p-ann", ...personaTurn };
    const { user } = render({ message, onReply });
    await user.click(screen.getByRole("button", { name: "Reply to Ann Lee" }));
    expect(onReply).toHaveBeenCalledWith(message);
  });

  it("shows Reply as an icon whose label appears on hover", async () => {
    const { user } = render({ message: personaTurn, onReply: vi.fn() });
    const reply = screen.getByRole("button", { name: "Reply to Ann Lee" });
    expect(reply).not.toHaveTextContent(/\S/); // icon only, no visible text

    await user.hover(reply);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Reply to Ann Lee");
  });

  it("hides Reply when onReply is omitted", () => {
    render({ message: personaTurn });
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });

  it("never offers Reply on a user turn", () => {
    render({ message: userTurn, onReply: vi.fn() });
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });

  it("shows the confidence level, score and its explanation trigger", () => {
    render({
      message: {
        ...personaTurn,
        confidence_level: "Medium Confidence; mixed purchase interest",
        confidence_score: 62,
      },
    });
    expect(screen.getByText("Confidence level:")).toBeInTheDocument();
    expect(screen.getByText(/Medium/)).toHaveTextContent("Medium · 62%");
    expect(screen.getByRole("button", { name: "Why this confidence level" })).toBeInTheDocument();
  });

  it("shows no confidence row content when the level is missing", () => {
    render({ message: personaTurn });
    expect(screen.queryByText("Confidence level:")).not.toBeInTheDocument();
  });
});
