import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { API_URL, ok } from "@/test/msw/handlers";
import { authenticate, makeProject } from "@/test/factories";
import { DataTable, paginationItems } from "../../../../components/common/Dashboard/DataTable";
import Column from "../../../../components/common/Dashboard/Column";
import type { Project } from "@/api/Projects/query";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateSpy,
}));

const baseProps = {
  columns: Column,
  search: "",
  onSearchChange: vi.fn(),
  pageIndex: 0,
  pageCount: 1,
  total: 1,
  pageSize: 10,
  onPageChange: vi.fn(),
  isFetching: false,
};

function renderTable(data: Project[], overrides: Partial<typeof baseProps> = {}) {
  return renderWithProviders(
    <DataTable {...baseProps} {...overrides} data={data} />,
  );
}

beforeEach(() => {
  navigateSpy.mockReset();
  authenticate();
});

describe("DataTable", () => {
  it("renders a row per project", () => {
    renderTable([
      makeProject({ project_id: "p1", project_name: "Alpha" }),
      makeProject({ project_id: "p2", project_name: "Beta" }),
    ]);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", () => {
    renderTable([]);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });

  it("relays search input changes to the parent", async () => {
    const onSearchChange = vi.fn();
    const { user } = renderTable([makeProject()], { onSearchChange });
    await user.type(screen.getByPlaceholderText("Find the project..."), "x");
    expect(onSearchChange).toHaveBeenCalledWith("x");
  });

  it("requests the next page from the > button", async () => {
    const onPageChange = vi.fn();
    const { user } = renderTable([makeProject()], {
      pageCount: 3,
      total: 25,
      onPageChange,
    });
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("requests the previous page from the < button, which is off on page 1", async () => {
    const onPageChange = vi.fn();
    const { user, rerender } = renderTable([makeProject()], {
      pageIndex: 0,
      pageCount: 3,
      total: 25,
      onPageChange,
    });
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    rerender(
      <DataTable
        {...baseProps}
        data={[makeProject()]}
        pageIndex={2}
        pageCount={3}
        total={25}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("always offers the first and last page", async () => {
    const onPageChange = vi.fn();
    const { user } = renderTable([makeProject()], {
      pageIndex: 0,
      pageCount: 17,
      total: 168,
      onPageChange,
    });

    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Page 17" }));
    expect(onPageChange).toHaveBeenCalledWith(16);
  });

  it("shows which projects are on screen", () => {
    renderTable([makeProject()], { pageIndex: 1, pageCount: 17, total: 168 });
    expect(screen.getByText("Showing 11–20 of 168 projects")).toBeInTheDocument();
  });

  it("changes how many projects a page shows", async () => {
    // Radix Select opens on pointer events jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    const onPageSizeChange = vi.fn();
    const { user } = renderWithProviders(
      <DataTable
        {...baseProps}
        data={[makeProject()]}
        pageCount={17}
        total={168}
        pageSizeOptions={[10, 20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const picker = screen.getByRole("combobox", { name: "Projects per page" });
    expect(picker).toHaveTextContent("10 per page");
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "50 per page" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("dims the current page while the next one loads", () => {
    const { rerender } = renderTable([makeProject({ project_id: "p1", project_name: "Alpha" })]);
    const body = () => screen.getByText("Alpha").closest("tbody")!;
    expect(body()).not.toHaveAttribute("aria-busy");

    rerender(
      <DataTable
        {...baseProps}
        data={[makeProject({ project_id: "p1", project_name: "Alpha" })]}
        isFetching
      />,
    );
    expect(body()).toHaveAttribute("aria-busy", "true");
    expect(body()).toHaveClass("opacity-50");
  });

  it("enters a new page's rows fresh when rows are keyed by project", () => {
    const getRowId = (p: Project) => p.project_id;
    const { rerender } = renderWithProviders(
      <DataTable {...baseProps} data={[makeProject({ project_id: "p1", project_name: "Alpha" })]} getRowId={getRowId} />,
    );
    const firstRow = screen.getByText("Alpha").closest("tr");

    rerender(
      <DataTable {...baseProps} data={[makeProject({ project_id: "p2", project_name: "Beta" })]} getRowId={getRowId} />,
    );
    // A different project gets a new row element (and so replays its entrance).
    expect(screen.getByText("Beta").closest("tr")).not.toBe(firstRow);
  });

  it("hides the page-size picker when there are no projects", () => {
    renderWithProviders(
      <DataTable
        {...baseProps}
        data={[]}
        total={0}
        pageCount={0}
        pageSizeOptions={[10, 20]}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox", { name: "Projects per page" })).not.toBeInTheDocument();
  });

  it("opens the edit dialog from a row's action menu", async () => {
    const { user } = renderTable([
      makeProject({ project_id: "p1", project_name: "Alpha" }),
    ]);

    await user.click(
      document.querySelector('[data-test-id="ACTION_Alpha"]') as HTMLElement,
    );
    await user.click(await screen.findByText("Edit"));

    expect(await screen.findByRole("heading", { name: "Edit Project" })).toBeInTheDocument();
  });

  it("opens the delete dialog and fires the delete request on confirm", async () => {
    let deleteBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}projects/delete`, async ({ request }) => {
        deleteBody = (await request.json()) as Record<string, unknown>;
        return ok({});
      }),
    );

    const { user } = renderTable([
      makeProject({ project_id: "p1", project_name: "Alpha" }),
    ]);

    await user.click(
      document.querySelector('[data-test-id="ACTION_Alpha"]') as HTMLElement,
    );
    await user.click(await screen.findByText("Delete"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteBody).not.toBeNull());
    expect(deleteBody).toMatchObject({ project_id: "p1" });
  });
});

describe("paginationItems", () => {
  const shown = (pageIndex: number, pageCount: number) =>
    paginationItems(pageIndex, pageCount).map((p) => (p === "gap" ? "…" : p + 1)).join(" ");

  it("shows every page when there are only a few", () => {
    expect(shown(0, 1)).toBe("1");
    expect(shown(0, 4)).toBe("1 2 3 4");
    expect(shown(0, 0)).toBe("");
  });

  it("keeps the first and last page around the current one", () => {
    expect(shown(0, 17)).toBe("1 2 3 … 17");
    expect(shown(8, 17)).toBe("1 … 8 9 10 … 17");
    expect(shown(16, 17)).toBe("1 … 15 16 17");
  });

  it("never hides a single page behind …", () => {
    expect(shown(3, 17)).toBe("1 2 3 4 5 … 17");
    expect(shown(13, 17)).toBe("1 … 13 14 15 16 17");
  });
});
