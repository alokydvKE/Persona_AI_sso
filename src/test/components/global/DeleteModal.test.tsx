import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteDialog from "../../../components/global/DeleteModal";

describe("DeleteDialog", () => {
  it("does not render content when closed", () => {
    render(<DeleteDialog open={false} setOpen={vi.fn()} onClick={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("renders the default project title and confirmation copy when open", async () => {
    render(<DeleteDialog open setOpen={vi.fn()} onClick={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Delete Project" })).toBeInTheDocument();
    expect(screen.getByText(/permanently removed/i)).toBeInTheDocument();
  });

  it("uses a custom title and description", async () => {
    render(
      <DeleteDialog
        open
        setOpen={vi.fn()}
        onClick={vi.fn()}
        title="Conversation"
        description="This chat will be gone."
      />,
    );
    expect(await screen.findByRole("heading", { name: "Delete Conversation" })).toBeInTheDocument();
    expect(screen.getByText("This chat will be gone.")).toBeInTheDocument();
  });

  it("invokes onClick when the Delete button is pressed", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<DeleteDialog open setOpen={vi.fn()} onClick={onClick} />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
