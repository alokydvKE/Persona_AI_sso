import { useEffect, useState } from "react";

import {
  getProjectList,
  PROJECTS_PAGE_SIZE,
  PROJECTS_PAGE_SIZE_OPTIONS,
  type Project,
} from "@/api/Projects/query";
import Column from "@/components/common/Dashboard/Column";
import { DataTable } from "@/components/common/Dashboard/DataTable";
import { useDebounce } from "@/hooks/useDebounce";

// The viewer's last page size, remembered in this browser only.
const PAGE_SIZE_KEY = "projects.pageSize";

function storedPageSize(): number {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return (PROJECTS_PAGE_SIZE_OPTIONS as readonly number[]).includes(saved)
      ? saved
      : PROJECTS_PAGE_SIZE;
  } catch {
    return PROJECTS_PAGE_SIZE;
  }
}

/** Keys rows by project, so each page's rows enter fresh rather than recycling. */
const projectRowId = (project: Project) => project.project_id;

const DashboardPage = () => {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(storedPageSize);
  const debouncedSearch = useDebounce(search, 400);

  // A new search resets back to the first page.
  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

  const { data, isFetching } = getProjectList(
    debouncedSearch,
    pageIndex * pageSize,
    pageSize,
  );

  const projects = data?.response.projects ?? [];
  const pagination = data?.response.pagination;
  const total = pagination?.total ?? 0;
  const pageCount = pagination?.total_pages ?? 0;

  // The page can outlive its rows (e.g. deleting the last project on the last
  // page): step back to the new last page instead of showing an empty one.
  useEffect(() => {
    if (pageCount > 0 && pageIndex > pageCount - 1) setPageIndex(pageCount - 1);
  }, [pageCount, pageIndex]);

  // Keep the first project on screen in view when the page size changes.
  const changePageSize = (next: number) => {
    setPageIndex(Math.floor((pageIndex * pageSize) / next));
    setPageSize(next);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(next));
    } catch {
      // Storage unavailable (private mode): the choice lasts this visit only.
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 p-4 md:p-4 duration-300 animate-in fade-in slide-in-from-bottom-1">
      <DataTable
        columns={Column}
        data={projects}
        search={search}
        onSearchChange={setSearch}
        pageIndex={pageIndex}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PROJECTS_PAGE_SIZE_OPTIONS}
        onPageSizeChange={changePageSize}
        onPageChange={setPageIndex}
        isFetching={isFetching}
        getRowId={projectRowId}
      />
    </div>
  );
};

export default DashboardPage;
