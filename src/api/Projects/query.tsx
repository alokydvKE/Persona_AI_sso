import { apiRequest } from "@/services/apiService";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type Project = {
  project_id: string;
  project_name: string;
  project_type: string;
  description: string | null;
  status: string;
  total_personas_count: number;
  personas_ready: number;
  total_files_count: number;
  files_processed: number;
};

type GetProjectListRes = {
  header: ResponseHeader;
  response: {
    projects: Project[];
    pagination: Pagination;
  };
};

/** Default page size for the projects listing (matches the backend default). */
export const PROJECTS_PAGE_SIZE = 10;

/** Page sizes the projects listing offers. */
export const PROJECTS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * POST /v1/projects/list — paginated, server-side searched project listing.
 *
 * `search`, `offset` and `limit` are all part of the query key so paging and
 * searching each refetch. `keepPreviousData` keeps the current page on screen
 * while the next one loads, avoiding an empty-table flash. The backend ignores
 * 1–2 character searches, so the query is disabled until the term clears or
 * reaches 3 characters.
 */
export const getProjectList = (
  search: string = "",
  offset: number = 0,
  limit: number = PROJECTS_PAGE_SIZE,
) => {
  const userStr = localStorage.getItem("user");
  const userData = userStr ? JSON.parse(atob(userStr)) : null;
  const token = userData?.token || "";

  return useQuery<GetProjectListRes, Record<string, any>>({
    queryKey: ["ProjectList", search, offset, limit],
    queryFn: async () => {
      const payload = { token, search, limit, offset };
      const res = await apiRequest("post", "projects/list", payload);
      const data = await res;
      return data.response;
    },
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: !!token && (search.length === 0 || search.length >= 3),
  });
};

type GetProjectRes = {
  header: ResponseHeader;
  response: Project;
};

/**
 * POST /v1/projects/get — full details for a single project.
 *
 * Used by the chat/persona views to show the active project's real name (instead
 * of a placeholder). Disabled until both the auth token and a `projectId` are
 * available, so it only fires once we know which project to load.
 */
export const useProjectDetail = (projectId: string | undefined) => {
  const userStr = localStorage.getItem("user");
  const userData = userStr ? JSON.parse(atob(userStr)) : null;
  const token = userData?.token || "";

  return useQuery<Project>({
    queryKey: ["ProjectDetail", projectId],
    queryFn: async () => {
      const payload = { token, project_id: projectId };
      const res = await apiRequest("post", "projects/get", payload);
      const data = await res;
      const envelope = data.response as GetProjectRes;
      return envelope.response;
    },
    enabled: !!token && !!projectId,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};
