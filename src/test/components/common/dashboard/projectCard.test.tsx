import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { makeProject } from "@/test/factories";
import ProjectCard from "@/components/common/Dashboard/projectCard";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

beforeEach(() => navigateSpy.mockReset());

describe("ProjectCard", () => {
  it("renders the project name and type", () => {
    renderWithProviders(
      <ProjectCard project={makeProject({ project_name: "Acme", project_type: "consultant" })} />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("consultant")).toBeInTheDocument();
  });

  it("pluralises file and persona counts correctly", () => {
    renderWithProviders(
      <ProjectCard
        project={makeProject({ total_files_count: 1, total_personas_count: 3 })}
      />,
    );
    expect(screen.getByText(/1 file$/)).toBeInTheDocument();
    expect(screen.getByText(/3 personas/)).toBeInTheDocument();
  });

  it("navigates to the chat view with the project id on click", async () => {
    const { user } = renderWithProviders(
      <ProjectCard project={makeProject({ project_id: "p7" })} />,
    );
    await user.click(screen.getByText("Test Project"));
    expect(navigateSpy).toHaveBeenCalledWith("/chat", {
      state: { projectId: "p7" },
    });
  });

  it("opens the delete confirmation without navigating", async () => {
    const { user, store } = renderWithProviders(
      <ProjectCard project={makeProject({ project_id: "p7" })} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete project" }));

    expect(store.getState().GlobalModal.ProjectDelete).toBe("p7");
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("opens the project when Enter is pressed (keyboard accessible)", async () => {
    const { user } = renderWithProviders(
      <ProjectCard project={makeProject({ project_id: "p9" })} />,
    );
    screen.getByRole("button", { name: /Test Project/i }).focus();
    await user.keyboard("{Enter}");
    expect(navigateSpy).toHaveBeenCalledWith("/chat", {
      state: { projectId: "p9" },
    });
  });
});
