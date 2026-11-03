import { useQuery } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";

type PersonaListResponse = {
  personas: PersonaListItem[];
};

/** POST /v1/persona/list — active personas for a project. */
export const usePersonaList = (projectId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<PersonaListResponse>({
    queryKey: ["PersonaList", projectId],
    queryFn: () =>
      postApi<PersonaListResponse>("persona/list", {
        token,
        project_id: projectId,
      }),
    enabled: Boolean(token && projectId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};

/** One categorised evidence item (run_query final_evidence_by_category). */
export type EvidenceItem = {
  label: string | null;
  support_pct: number | null;
  n: number | null;
  question?: string | null;
  option?: string | null;
  study_type_id?: string | null;
};

/** Evidence grouped by theme, as produced by run_query for a persona. */
export type EvidenceCategory = {
  theme_id: string;
  theme_name: string;
  items: EvidenceItem[];
};

/** One row of a persona's study breakdown (run_query study_summary). */
export type StudySummaryRow = {
  study_type_id: string;
  total_rows: number;
  unique_respondent_count: number;
};

/** Per-persona run_query output surfaced on the dashboard. */
export type DashboardPersona = {
  persona_id: string;
  persona_name: string | null;
  status: string;
  /** run_query coverage as a percentage (0-100); null until the pipeline emits it. */
  final_coverage: number | null;
  matched_respondents: number;
  unique_studies: number;
  unique_respondents: number;
  study_summary: StudySummaryRow[];
  evidence_by_category: EvidenceCategory[];
  /** True when this persona matched fewer respondents than the configured
   * minimum (see persona_service.persona_dashboard) — too little data to chat with. */
  insufficient_data: boolean;
};

type PersonaDashboardResponse = {
  summary: {
    personas_created: number;
    insufficient_data: number;
    data_files: number;
    /** Distinct studies / respondents across all personas (run_query rollups). */
    unique_studies: number;
    unique_respondents: number;
  };
  personas: DashboardPersona[];
};

/**
 * POST /v1/persona/dashboard — aggregate counts for the panel header plus each
 * persona's run_query result (study breakdown + evidence-by-category).
 */
export const usePersonaDashboard = (projectId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<PersonaDashboardResponse>({
    queryKey: ["PersonaDashboard", projectId],
    queryFn: () =>
      postApi<PersonaDashboardResponse>("persona/dashboard", {
        token,
        project_id: projectId,
      }),
    enabled: Boolean(token && projectId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};

/* ------------------------------------------------------------------ */
/* One builder chat's personas ("Build results")                      */
/* ------------------------------------------------------------------ */

/** A persona in a builder chat's build results: dashboard shape plus extras. */
export type BuildResultPersona = DashboardPersona & {
  persona_index: number | null;
  /** False until run_query has written this persona's results. */
  has_query_results: boolean;
  /** Palette word (green, blue, …) in build order, as group chat assigns it. */
  color: string;
};

export type BuilderPersonasResponse = {
  conversation_id: string;
  project_id: string;
  /** Null until the chat's build has been dispatched. */
  build: {
    job_id: string;
    status: "queued" | "running" | "done" | "failed";
    progress: number;
  } | null;
  summary: {
    personas_created: number;
    insufficient_data: number;
    insufficient_data_threshold: number;
    unique_studies: number;
    unique_respondents: number;
  };
  personas: BuildResultPersona[];
};

export const builderPersonasKey = (conversationId: string | undefined) => [
  "BuilderPersonas",
  conversationId,
];

/** Refresh cadence (ms) while the build is still analysing its personas. */
const BUILD_RESULTS_POLL_MS = 4000;

/**
 * POST /v1/persona/chat/personas — the personas one builder chat built, with
 * their study/evidence results. Keeps refreshing while the build is still
 * running, so results fill in without reopening anything. Silent: the drawer
 * shows its own error state rather than a toast on top of it.
 */
export const useBuilderPersonas = (conversationId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<BuilderPersonasResponse>({
    queryKey: builderPersonasKey(conversationId),
    queryFn: () =>
      postApi<BuilderPersonasResponse>(
        "persona/chat/personas",
        { token, conversation_id: conversationId },
        { silent: true },
      ),
    enabled: Boolean(token && conversationId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.build?.status;
      return status === "queued" || status === "running" ? BUILD_RESULTS_POLL_MS : false;
    },
  });
};

/* ------------------------------------------------------------------ */
/* persona_query background job (run_query)                           */
/* ------------------------------------------------------------------ */

/** One persona's run_query output, as carried by the job result. */
export type RunQueryPersona = {
  persona_index: number | null;
  study_summary: StudySummaryRow[];
  final_evidence_by_category: EvidenceCategory[];
};

/** The job's result JSON once run_query finishes. */
export type PersonaQueryJobResult = {
  personas: RunQueryPersona[];
  error?: string;
};

/** Aggregate status of one build step, rolled up across all personas in the job. */
export type PersonaBuildStepStatus = "pending" | "running" | "done" | "failed";

/**
 * One step of the persona_query build stepper. Counts are across all personas in
 * the job, so `done`/`total` drives the "2 of 3 personas" badge. A step reads
 * `done` only once every persona has cleared it.
 */
export type PersonaBuildStep = {
  key: string;
  label: string;
  status: PersonaBuildStepStatus;
  done: number;
  failed: number;
  total: number;
};

/** Inner payload of POST /v1/projects/job-status for a persona_query job. */
export type PersonaBuildJob = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: PersonaQueryJobResult | null;
  /** Per-step stepper; null for jobs that don't report steps. */
  steps: PersonaBuildStep[] | null;
};

/** Polling cadence (ms) while a build job is in flight. */
const JOB_POLL_INTERVAL_MS = 1200;

/**
 * POST /v1/projects/job-status — poll a persona_query job until it settles.
 *
 * Refetches every {@link JOB_POLL_INTERVAL_MS} while the job is queued/running
 * and stops once it is done/failed, so the progress bar advances live without a
 * manual interval. Disabled until a jobId is provided.
 */
export const usePersonaBuildJob = (
  jobId: string | null | undefined,
  /**
   * Seed from /chat/history so a reopened chat paints the build's real state on
   * the first render instead of defaulting to the "running" loader until the
   * first poll returns. When it seeds an already-settled build, the query is kept
   * fresh (staleTime ∞) so it never polls — there is nothing left to watch.
   */
  initialData?: PersonaBuildJob,
) => {
  const token = getAuthToken();
  const settled =
    initialData?.status === "done" || initialData?.status === "failed";
  return useQuery<PersonaBuildJob>({
    queryKey: ["PersonaBuildJob", jobId],
    queryFn: () =>
      postApi<PersonaBuildJob>("projects/job-status", {
        token,
        job_id: jobId,
      }),
    enabled: Boolean(token && jobId),
    initialData,
    staleTime: settled ? Infinity : 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : JOB_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
};
