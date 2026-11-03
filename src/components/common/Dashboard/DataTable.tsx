import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// import ColumnDropdown from "./ColumnDropdown";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/common/EmptyState";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Search,
  Table as TableIcon,
} from "lucide-react";
import ProjectCard from "./projectCard";
import { cn } from "@/lib/utils";
import CreateProjectDailog from "./CreateProjectDailog";
import EditProjectDialog from "./EditProjectDialog";
import DeleteDialog from "@/components/global/DeleteModal";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/redux/store";
import { setProjectDelete } from "@/redux/GlobalModalSlice";
import { DeleteProject } from "@/api/Projects/mutation";
import { useState } from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Controlled search term (server-side). */
  search: string;
  onSearchChange: (value: string) => void;
  /** Zero-based index of the current page. */
  pageIndex: number;
  /** Total number of pages reported by the backend. */
  pageCount: number;
  /** Total number of rows reported by the backend. */
  total: number;
  pageSize: number;
  /** Page sizes to offer; the picker is hidden without them. */
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  onPageChange: (pageIndex: number) => void;
  /** True while a page/search request is in flight. */
  isFetching?: boolean;
  /**
   * Stable id per row (e.g. the project id). Rows are otherwise keyed by
   * position, so a new page would reuse the old rows instead of entering fresh.
   */
  getRowId?: (row: TData, index: number) => string;
}

/**
 * Page buttons to show: always the first and last page, the current one with
 * its neighbours, and "gap" where pages are skipped — `1 2 3 … 17`,
 * `1 … 8 9 10 … 17`, `1 … 15 16 17`. A gap of one page shows that page
 * instead, so there is never a "…" standing in for a single number.
 */
export function paginationItems(pageIndex: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 0) return [];
  const last = pageCount - 1;
  // The current page's neighbours; near either end, the first/last three.
  const lo = Math.min(Math.max(pageIndex - 1, 0), Math.max(last - 2, 0));
  const hi = Math.max(Math.min(pageIndex + 1, last), Math.min(2, last));
  const keep = new Set([0, last]);
  for (let i = lo; i <= hi; i++) keep.add(i);

  const pages = [...keep].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  pages.forEach((page, i) => {
    const prev = pages[i - 1];
    if (i > 0 && page - prev === 2) items.push(prev + 1);
    else if (i > 0 && page - prev > 2) items.push("gap");
    items.push(page);
  });
  return items;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  search,
  onSearchChange,
  pageIndex,
  pageCount,
  total,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  onPageChange,
  isFetching,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [content, setContent] = useState<"Table" | "Card">("Table");
  const { ProjectDelete } = useSelector(
    (state: RootState) => state.GlobalModal,
  );
  const isMobile = useIsMobile();
  const dispatch = useDispatch<AppDispatch>();
  const { mutate } = DeleteProject();

  // Pagination is server-driven, so react-table is used only to render columns.
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    getRowId,
  });

  // While the next page / search result loads, the current one stays on screen
  // (keepPreviousData) but dims, so it reads as on its way out.
  const refreshing = Boolean(isFetching) && data.length > 0;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <Tabs
      value={content}
      onValueChange={(e: string) => setContent(e as "Table" | "Card")}
      className="w-full space-y-6"
    >
      {/* HEADER CONTROLS BAR */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input styled to match landing form boxes */}
        <div className="relative flex-1 max-w-md flex items-center bg-white rounded-lg border border-[#ECECEC] px-4 shadow-sm focus-within:border-[#6338F6]/50 transition-all">
          <Search size={18} className="text-[#6B7280] mr-2" />
          <Input
            placeholder="Find the project..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 border-none rounded-none focus-visible:ring-0 px-0 bg-transparent text-[#111827]"
          />
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex items-center justify-end gap-3">
          <CreateProjectDailog />
          {/* Column selector temporarily hidden. */}
          {/* {content === "Table" && <ColumnDropdown table={table} />} */}

          <TabsList className="bg-[#F5F6FF] border border-[#E8ECFF] p-1 h-12 rounded-xl">
            <TabsTrigger
              value="Table"
              className="rounded-lg gap-2 cursor-pointer data-[state=active]:bg-white data-[state=active]:text-[#6338F6] data-[state=active]:shadow-sm text-[#4B5563]"
            >
              <TableIcon size={16} />
              <span className="hidden md:inline">Table</span>
            </TabsTrigger>
            <TabsTrigger
              value="Card"
              className="rounded-lg gap-2 cursor-pointer data-[state=active]:bg-white data-[state=active]:text-[#6338F6] data-[state=active]:shadow-sm text-[#4B5563]"
            >
              <LayoutGrid size={16} />
              <span className="hidden md:inline">Card</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* VIEWPORT AREA */}
      {/* Switching views cross-fades (inactive content is unmounted). */}
      <TabsContent
        value="Table"
        className="mt-0 outline-none data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in motion-reduce:animate-none"
      >
        <div className="bg-white rounded-lg border border-white/60 shadow-[0_15px_50px_rgba(99,56,246,0.04)] overflow-hidden">
          <Table
            data-test-id="DASHBOARD"
            containerClassName="max-h-[60vh] overflow-y-auto"
          >
            <TableHeader className="sticky top-0 z-20 bg-gradient-to-br from-[#eef1ff] via-[#f8f9ff] to-[#e8ecff] border-b border-[#F1F1F1] [&_tr]:bg-transparent">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent border-none"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-14 text-xs font-semibold tracking-wider text-[#4B5563] uppercase first:pl-8 last:pr-8"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody
              aria-busy={refreshing || undefined}
              className={cn(
                "transition-opacity duration-200",
                refreshing && "pointer-events-none opacity-50",
              )}
            >
              {isFetching && data.length === 0 ? (
                // Skeleton rows on the first load (keepPreviousData covers paging).
                Array.from({ length: 6 }).map((_, rowIdx) => (
                  <TableRow
                    key={`skeleton-${rowIdx}`}
                    className="border-b border-[#F1F1F1] last:border-none"
                  >
                    {Array.from({ length: columns.length }).map(
                      (__, cellIdx) => (
                        <TableCell
                          key={cellIdx}
                          className="py-4 first:pl-8 last:pr-8"
                        >
                          <Skeleton className="h-4 w-full max-w-[180px]" />
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    style={{
                      animationDelay: `${Math.min(index, 12) * 30}ms`,
                      animationFillMode: "backwards",
                    }}
                    // Hover (or keyboard focus): a lavender tint, and the project
                    // name in the brand colour.
                    className="group/row border-b border-[#F1F1F1] last:border-none transition-colors duration-200 hover:bg-[#F7F5FF] focus-within:bg-[#F7F5FF] animate-in fade-in slide-in-from-bottom-1 motion-reduce:transition-none"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-4 text-sm text-[#111827] first:pl-8 last:pr-8"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      icon={<FolderOpen className="h-6 w-6" />}
                      title="No projects found"
                      description={
                        search
                          ? "Try a different search term."
                          : "Create your first project to start building personas."
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent
        value="Card"
        className="mt-0 outline-none data-[state=active]:duration-300 data-[state=active]:animate-in data-[state=active]:fade-in motion-reduce:animate-none"
      >
        <div
          aria-busy={refreshing || undefined}
          className={cn(
            "grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3",
            refreshing && "pointer-events-none opacity-50",
          )}
        >
          {isFetching && data.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`card-skeleton-${i}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
              >
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={<FolderOpen className="h-6 w-6" />}
                title="No projects found"
                description={
                  search
                    ? "Try a different search term."
                    : "Create your first project to start building personas."
                }
              />
            </div>
          ) : (
            table
              .getRowModel()
              .rows.map((p, index) => (
                <ProjectCard
                  key={p.id}
                  project={p.original as any}
                  index={index}
                />
              ))
          )}
        </div>
      </TabsContent>

      {/* PAGINATION CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F1F1] pt-4">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          {isMobile ? (
            <span>
              Page {pageIndex + 1} of {Math.max(pageCount, 1)}
            </span>
          ) : (
            <span>
              {total === 0
                ? "No projects"
                : `Showing ${from}–${to} of ${total} projects`}
            </span>
          )}

          {pageSizeOptions && onPageSizeChange && total > 0 && (
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              disabled={isFetching}
            >
              <SelectTrigger
                aria-label="Projects per page"
                className="gap-1.5 rounded-lg border-[#ECECEC] bg-white px-3 text-sm text-[#111827] shadow-none data-[size=default]:h-9 [&_svg]:text-[#6B7280]"
              >
                <SelectValue>{pageSize} per page</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canPrev || isFetching}
            aria-label="Previous page"
            className="rounded-md border-[#ECECEC] text-[#4B5563] hover:bg-[#F5F6FF] hover:text-[#6338F6]"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>

          {!isMobile && (
            <div className="flex items-center gap-1">
              {paginationItems(pageIndex, pageCount).map((item, i) =>
                item === "gap" ? (
                  <span
                    key={`gap-${i}`}
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center text-sm text-[#9CA3AF]"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    disabled={isFetching || pageIndex === item}
                    aria-label={`Page ${item + 1}`}
                    aria-current={pageIndex === item ? "page" : undefined}
                    className={cn(
                      "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6338F6]/40",
                      pageIndex === item
                        ? "bg-[#6338F6] text-white shadow-sm shadow-[#6338F6]/25"
                        : "text-[#4B5563] hover:bg-[#F5F6FF] hover:text-[#6338F6] disabled:opacity-50",
                    )}
                  >
                    {item + 1}
                  </button>
                ),
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNext || isFetching}
            aria-label="Next page"
            className="rounded-md border-[#ECECEC] text-[#4B5563] hover:bg-[#F5F6FF] hover:text-[#6338F6]"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      </div>
      <DeleteDialog
        open={ProjectDelete !== null}
        setOpen={() => dispatch(setProjectDelete(null))}
        onClick={() => mutate({ project_id: ProjectDelete as string })}
      />
      <EditProjectDialog />
    </Tabs>
  );
}
