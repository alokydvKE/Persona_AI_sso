import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate, makeProject } from "@/test/factories";
import EditProjectDialog from "@/components/common/Dashboard/EditProjectDialog";

beforeEach(() => authenticate());

const editingState = (project = makeProject()) => ({
  GlobalModal: { ProjectDelete: null, ProjectEdit: project },
});

describe("EditProjectDialog", () => {
  it("stays closed when no project is selected for editing", () => {
    renderWithProviders(<EditProjectDialog />);
    expect(screen.queryByRole("heading", { name: "Edit Project" })).not.toBeInTheDocument();
  });

  it("opens prefilled with the selected project's details", async () => {
    renderWithProviders(<EditProjectDialog />, {
      preloadedState: editingState(
        makeProject({ project_name: "Old Name", description: "Old description" }),
      ),
    });

    expect(await screen.findByRole("heading", { name: "Edit Project" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Old Name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Old description")).toBeInTheDocument();
  });

  it("shows a validation error when the title is too short", async () => {
    const { user } = renderWithProviders(<EditProjectDialog />, {
      preloadedState: editingState(),
    });

    const title = await screen.findByDisplayValue("Test Project");
    await user.clear(title);
    await user.type(title, "a");
    await user.click(
      document.querySelector('[data-test-id="EDIT_SUBMIT_PROJECT"]') as HTMLElement,
    );

    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
  });

  it("saves changes and closes the dialog on success", async () => {
    server.use(http.post(`${API_URL}projects/update`, () => ok({})));
    const { user, store } = renderWithProviders(<EditProjectDialog />, {
      preloadedState: editingState(makeProject({ project_id: "p55" })),
    });

    const title = await screen.findByDisplayValue("Test Project");
    await user.clear(title);
    await user.type(title, "Renamed Project");
    await user.click(
      document.querySelector('[data-test-id="EDIT_SUBMIT_PROJECT"]') as HTMLElement,
    );

    await waitFor(() =>
      expect(store.getState().GlobalModal.ProjectEdit).toBeNull(),
    );
  });
});
