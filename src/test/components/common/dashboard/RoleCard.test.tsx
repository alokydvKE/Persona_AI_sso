import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleCard from "../../../../components/common/Dashboard/RoleCard";

const role = {
  id: "brand_representative" as const,
  title: "Brand Representative",
  description: "Represent a brand and build personas.",
  icon: () => <svg data-testid="role-icon" />,
  features: ["Upload data", "Create personas", "Get insights"],
};

describe("RoleCard", () => {
  it("renders the title, description and all features", () => {
    render(<RoleCard role={role} isSelected={false} setSelected={vi.fn()} />);
    expect(screen.getByText("Brand Representative")).toBeInTheDocument();
    expect(screen.getByText("Represent a brand and build personas.")).toBeInTheDocument();
    role.features.forEach((f) => expect(screen.getByText(f)).toBeInTheDocument());
  });

  it("calls setSelected when clicked", async () => {
    const setSelected = vi.fn();
    const user = userEvent.setup();
    render(<RoleCard role={role} isSelected={false} setSelected={setSelected} />);

    await user.click(screen.getByText("Brand Representative"));
    expect(setSelected).toHaveBeenCalledTimes(1);
  });

  it("applies the selected ring styling when selected", () => {
    const { container } = render(
      <RoleCard role={role} isSelected setSelected={vi.fn()} />,
    );
    expect(container.querySelector(".ring-2")).toBeInTheDocument();
  });
});
