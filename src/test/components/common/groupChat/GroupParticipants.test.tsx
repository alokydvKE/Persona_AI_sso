import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import GroupParticipants from "../../../../components/common/Chat/GroupChat/GroupParticipants";

// projectId is left undefined so the persona detail queries stay disabled
// (no network); the component still renders entirely from the participants prop.
type Participant = { persona_id: string; persona_name: string; color: string };

const make = (n: number): Participant[] =>
  Array.from({ length: n }, (_, i) => ({
    persona_id: `p${i}`,
    persona_name: `Persona ${i}`,
    color: "blue",
  }));

const render = (participants: Participant[]) =>
  renderWithProviders(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <GroupParticipants participants={participants as any} projectId={undefined} />,
  );

describe("GroupParticipants", () => {
  it("renders nothing when there are no participants", () => {
    const { container } = render([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an avatar per participant with their initials", () => {
    render([
      { persona_id: "a", persona_name: "Ann Lee", color: "green" },
      { persona_id: "b", persona_name: "Bob Ray", color: "blue" },
    ]);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("BR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 personas/i })).toBeInTheDocument();
  });

  it("collapses extra avatars into a +N overflow pill", () => {
    render(make(7)); // MAX_AVATARS is 5 -> overflow of 2
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("opens the full participant list from the count button", async () => {
    const { user } = render(make(2));
    await user.click(screen.getByRole("button", { name: /2 personas/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Participants")).toBeInTheDocument();
    expect(within(dialog).getByText("Persona 0")).toBeInTheDocument();
  });

  it("opens a persona's detail view when their avatar is clicked", async () => {
    const { user } = render([
      { persona_id: "a", persona_name: "Ann Lee", color: "green" },
    ]);
    await user.click(screen.getByText("AL"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ann Lee")).toBeInTheDocument();
  });
});
