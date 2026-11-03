import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { authenticate } from "@/test/factories";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavUser } from "../../../components/global/NavUser";

beforeEach(() => authenticate());

const renderNavUser = () =>
  renderWithProviders(
    <SidebarProvider>
      <NavUser />
    </SidebarProvider>,
  );

describe("NavUser", () => {
  it("renders the user's name and initials", () => {
    renderNavUser();
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TU").length).toBeGreaterThan(0);
  });

  it("exposes a Log out action in the menu", async () => {
    const { user } = renderNavUser();
    await user.click(screen.getAllByText("Test User")[0]);
    expect(await screen.findByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });
});
