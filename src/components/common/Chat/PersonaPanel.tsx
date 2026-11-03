import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Filter,
  Info,
  LayoutGrid,
  List,
  MessageSquare,
  Pencil,
  Users,
  XCircle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/loader";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/common/EmptyState";
import Collapse from "@/components/common/Collapse";
import PersonaEvidence, { COVERAGE_HOVER_TEXT } from "./PersonaEvidence";
import ProjectDataFilesList from "./ProjectDataFilesList";
import DataSourceBadge, {
  DATA_SOURCE_KEYS,
  DATA_SOURCE_META,
} from "./DataSourceBadge";

import {
  usePersonaList,
  usePersonaDashboard,
  type DashboardPersona,
} from "@/api/Persona/query";
import { usePersonaUpdate } from "@/api/Persona/mutation";
import { useStartGroupChat } from "@/api/GroupChat/mutation";
import type { DataSourceKey } from "@/api/Chat/query";
import { personaInitials } from "@/lib/personaColors";
import { PICK_ITEM, PICK_MENU } from "@/lib/menuStyles";
import { groupChatTitle } from "@/lib/chatTitles";
import { cn } from "@/lib/utils";

const INSUFFICIENT_DATA_TOOLTIP =
  "This persona doesn't have sufficient respondent data.";

/**
 * Marks a persona built by the builder chat the user is in: a thin purple tab
 * on its row/card's left edge (the row must be `relative`), named for
 * assistive tech.
 */
// function FromThisChatEdge() {
//   return (
//     <>
//       <span
//         aria-hidden="true"
//         className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary/70"
//       />
//       <span className="sr-only">Built in this chat</span>
//     </>
//   );
// }

/** Shown in place of the status so a non-selectable persona says why at a glance. */
function InsufficientDataBadge() {
  return (
    <span className="font-medium text-red-600" title={INSUFFICIENT_DATA_TOOLTIP}>
      Insufficient data
    </span>
  );
}

const confidenceColors: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Med-High": "bg-sky-100 text-sky-800 border-sky-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-rose-100 text-rose-800 border-rose-200",
};

function coverageColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 70) return "bg-sky-500";
  return "bg-amber-500";
}

/**
 * True when a persona came from the persona-builder agent (vs. data-file
 * generation). Builder personas have no meaningful coverage/confidence, so
 * those columns are hidden for them.
 */
function isBuilderPersona(p: PersonaListItem): boolean {
  return (
    p.persona_index != null ||
    Boolean(p.industry || p.category || p.sub_category_id || p.demographics) ||
    [
      p.micro_category,
      p.theme_ids,
      p.construct_ids,
      p.role_type_ids,
      p.timeframe_ids,
      p.entity_scope_ids,
      p.profile_ids,
    ].some((a) => a != null && a.length > 0)
  );
}

/** How the persona list is ordered. */
type PersonaSort =
  | "coverage"
  | "coverage-asc"
  | "respondents"
  | "studies"
  | "name"
  | "name-desc"
  | "default";

/** `label` is the menu row; `short` follows "Sort:" on the button. */
const SORT_OPTIONS: { value: PersonaSort; label: string; short: string }[] = [
  { value: "coverage", label: "Coverage: highest first", short: "Coverage" },
  { value: "coverage-asc", label: "Coverage: lowest first", short: "Lowest coverage" },
  { value: "respondents", label: "Most respondents", short: "Respondents" },
  { value: "studies", label: "Most studies", short: "Studies" },
  { value: "name", label: "Name: A to Z", short: "Name A–Z" },
  { value: "name-desc", label: "Name: Z to A", short: "Name Z–A" },
  { value: "default", label: "Default order", short: "Default" },
];

const DEFAULT_SORT: PersonaSort = "coverage";

const nameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/**
 * The coverage figure a persona's card shows: the dashboard's evidence-backed
 * number when it has one, else the list's own figure for a data-file persona.
 * Builder personas have none until the dashboard supplies it.
 */
function coverageOf(
  persona: PersonaListItem,
  dash: DashboardPersona | undefined,
): number | null {
  if (typeof dash?.final_coverage === "number") return dash.final_coverage;
  if (isBuilderPersona(persona)) return null;
  return Number.isFinite(persona.coverage) ? persona.coverage : null;
}

/**
 * Orders `list` in place. Personas with nothing to sort on (no coverage, no
 * respondent data, no name) go last whichever the direction, and Array#sort
 * is stable, so ties keep the default order.
 */
function sortPersonas(
  list: PersonaListItem[],
  sort: PersonaSort,
  evidence: Map<string, DashboardPersona>,
): PersonaListItem[] {
  if (sort === "default") return list;

  if (sort === "name" || sort === "name-desc") {
    const dir = sort === "name" ? 1 : -1;
    return list.sort((a, b) => {
      const na = a.persona_name?.trim();
      const nb = b.persona_name?.trim();
      if (!na || !nb) return Number(!na) - Number(!nb);
      return dir * nameCollator.compare(na, nb);
    });
  }

  const valueOf = (p: PersonaListItem): number | null => {
    const dash = evidence.get(p.persona_id);
    if (sort === "respondents") return dash ? dash.unique_respondents : null;
    if (sort === "studies") return dash ? dash.unique_studies : null;
    return coverageOf(p, dash);
  };
  // Highest first, except "lowest coverage".
  const dir = sort === "coverage-asc" ? 1 : -1;
  const values = new Map(list.map((p) => [p.persona_id, valueOf(p)]));
  return list.sort((a, b) => {
    const va = values.get(a.persona_id) ?? null;
    const vb = values.get(b.persona_id) ?? null;
    if (va === null || vb === null) return Number(va === null) - Number(vb === null);
    return dir * (va - vb);
  });
}

// Radix wraps an option's text in an inline span; making it flex lets the
// persona count sit at the right edge.
const COUNTED_ITEM =
  "[&>span:last-child]:flex [&>span:last-child]:flex-1 [&>span:last-child]:items-center";

// Shared look of the toolbar controls above the persona list.
const TOOLBAR_CONTROL = "h-8 rounded-lg bg-background px-2.5 text-xs font-medium";

function SummaryCard({
  icon,
  value,
  label,
  iconBg,
  active,
  onClick,
  loading = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconBg: string;
  /** This tile's view is the one shown below. */
  active: boolean;
  onClick: () => void;
  /** Its number hasn't arrived yet: a placeholder rather than a false 0. */
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-busy={loading || undefined}
      className="h-fit rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "h-fit cursor-pointer transition-shadow duration-200 hover:shadow-md",
          active && "ring-2 ring-primary",
        )}
      >
        <CardContent className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              iconBg,
            )}
          >
            {icon}
          </div>
          <div>
            {loading ? (
              <Skeleton
                data-testid="summary-value-skeleton"
                className="mb-1 h-7 w-10 rounded-md"
              />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/** Placeholder for a grid card's run_query output (coverage + evidence) while the
 * dashboard query is still loading. Mirrors PersonaEvidence's layout. */
function EvidenceSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 border-t pt-3">
      <div className="rounded-lg border p-3">
        <Skeleton className="mb-2 h-2.5 w-24" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-2 h-2.5 w-16" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border p-3">
            <Skeleton className="mb-2 h-3.5 w-32" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single loading row for the list view. */
function PersonaListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 ring-1 ring-foreground/5">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="hidden h-8 w-36 shrink-0 rounded sm:block" />
      <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
    </div>
  );
}

/** What the panel body shows — chosen by clicking one of the summary tiles. */
type PanelView = "personas" | "insufficient" | "files";

type PersonaPanelProps = {
  projectId: string | undefined;
  /** Called after a chat is successfully started (e.g. to close a dialog). */
  onStarted?: () => void;
  /** Height of the scrollable persona grid. */
  scrollHeight?: string;
  /**
   * Open on this persona: its evidence starts expanded and its row lightly
   * highlighted (used when a builder chat's build results link here).
   */
  focusPersonaId?: string | null;
  /**
   * Personas built by the builder chat the user is in. They get a thin purple
   * tab on their left edge so they stand out among the project's others.
   */
  chatPersonaIds?: ReadonlySet<string>;
};

/**
 * Persona dashboard content: summary counts plus a grid of persona cards.
 *
 * Launch point for chat — "Chat" starts a one-persona group chat, the
 * multi-select footer starts a group chat with several personas. Single and
 * multiple persona chats both run through the group-chat endpoints. Used inline
 * as a project's persona dashboard and inside PersonaPanelDialog.
 */
function PersonaPanel({
  projectId,
  onStarted,
  scrollHeight = "h-[420px]",
  focusPersonaId = null,
  chatPersonaIds,
}: PersonaPanelProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Expand is per grid ROW, not per card: collapsed rows share a fixed card
  // height (evidence scrolls inside); expanding one card expands the whole row
  // and stretches every card in it to one shared height. Keyed by row index,
  // which depends on how many columns the responsive grid currently shows.
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [columns, setColumns] = useState(3);
  // Dashboard layout: rich "grid" cards or a compact "list" for scanning many.
  const [view, setView] = useState<"grid" | "list">("list");
  const [sort, setSort] = useState<PersonaSort>(DEFAULT_SORT);
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.short ?? SORT_OPTIONS[0].short;
  // Which dataset's personas to show; "all" shows every persona.
  const [sourceFilter, setSourceFilter] = useState<"all" | DataSourceKey>(
    "all",
  );
  // Which summary tile is selected: all personas, only the insufficient-data
  // ones, or the project's uploaded data files.
  const [panelView, setPanelView] = useState<PanelView>("personas");
  // List view: which rows have their evidence panel expanded (by persona id).
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});
  const toggleEvidence = (id: string) =>
    setOpenEvidence((prev) => ({ ...prev, [id]: !prev[id] }));

  const personasQuery = usePersonaList(projectId);
  const dashboardQuery = usePersonaDashboard(projectId);
  const startGroup = useStartGroupChat();

  // Order personas by their persona_index (0,1,2,3…) so the panel is stable and
  // matches the dashboard sequence. Personas without an index (non-builder) keep
  // their original order after the indexed ones. Copy first — never sort the
  // TanStack Query cache array in place.
  const allPersonas = useMemo(() => {
    const list = personasQuery.data?.personas ?? [];
    return [...list].sort(
      (a, b) =>
        (a.persona_index ?? Number.POSITIVE_INFINITY) -
        (b.persona_index ?? Number.POSITIVE_INFINITY),
    );
  }, [personasQuery.data?.personas]);
  const summary = dashboardQuery.data?.summary;

  // Personas per dataset, for the filter's counts.
  const sourceCounts = useMemo(() => {
    const counts: Record<DataSourceKey, number> = {
      master: 0,
      uploaded: 0,
      combined: 0,
    };
    for (const p of allPersonas) counts[p.data_source ?? "master"] += 1;
    return counts;
  }, [allPersonas]);

  // run_query output (study breakdown + evidence) keyed by persona_id, merged
  // onto each list card below.
  const evidenceByPersona = useMemo(() => {
    const map = new Map<string, DashboardPersona>();
    for (const p of dashboardQuery.data?.personas ?? []) {
      map.set(p.persona_id, p);
    }
    return map;
  }, [dashboardQuery.data?.personas]);

  // What the dashboard renders, in the chosen order. Selection, select-all and
  // group chat all work on this list, so a hidden persona is never silently
  // part of a group chat. The "Insufficient Data" tile narrows it to the
  // personas that fell short.
  const personas = useMemo(
    () =>
      sortPersonas(
        // filter() copies, so sorting in place never touches allPersonas.
        allPersonas.filter(
          (p) =>
            (sourceFilter === "all" ||
              (p.data_source ?? "master") === sourceFilter) &&
            (panelView !== "insufficient" ||
              Boolean(evidenceByPersona.get(p.persona_id)?.insufficient_data)),
        ),
        sort,
        evidenceByPersona,
      ),
    [allPersonas, sourceFilter, panelView, evidenceByPersona, sort],
  );

  // Track the grid's column count (1 below the md breakpoint, 3 at/above it) so
  // personas can be grouped into rows and a whole row expanded together.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setColumns(mq.matches ? 3 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Clear selection + collapse everything when the project changes.
  useEffect(() => {
    setSelected({});
    setPendingId(null);
    setExpandedRows({});
    setOpenEvidence({});
    setSourceFilter("all");
    setPanelView("personas");
  }, [projectId]);

  // Rows are keyed by index, which shifts when the filter or order changes.
  useEffect(() => {
    setExpandedRows({});
  }, [sourceFilter, panelView, sort]);

  // Opened on one persona: once it has loaded, show it in the list with its
  // evidence open, scrolled into view and lightly highlighted. Applied once,
  // so collapsing it afterwards sticks.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusPersonaId || highlightId === focusPersonaId) return;
    if (!allPersonas.some((p) => p.persona_id === focusPersonaId)) return;
    setPanelView("personas");
    setView("list");
    setSourceFilter("all");
    setOpenEvidence((prev) => ({ ...prev, [focusPersonaId]: true }));
    setHighlightId(focusPersonaId);
  }, [focusPersonaId, allPersonas, highlightId]);
  useEffect(() => {
    if (!highlightId) return;
    highlightRowRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [highlightId]);

  // A persona that matched too few respondents can't be chatted with — never
  // selectable, never part of "select all", never a valid chat target, even if
  // a disabled control were somehow bypassed (checked again in startChat below).
  const isInsufficientData = (personaId: string) =>
    Boolean(evidenceByPersona.get(personaId)?.insufficient_data);

  const selectedPersonas = useMemo(
    () => personas.filter((p) => selected[p.persona_id]),
    [personas, selected],
  );

  // Whether any persona on screen carries the "built in this chat" edge.
  // const showsChatPersonas = useMemo(
  //   () => Boolean(chatPersonaIds?.size) && personas.some((p) => chatPersonaIds?.has(p.persona_id)),
  //   [chatPersonaIds, personas],
  // );

  const selectablePersonas = useMemo(
    () => personas.filter((p) => !isInsufficientData(p.persona_id)),
    [personas, evidenceByPersona],
  );

  const allSelected =
    selectablePersonas.length > 0 &&
    selectedPersonas.length === selectablePersonas.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      setSelected(
        Object.fromEntries(selectablePersonas.map((p) => [p.persona_id, true])),
      );
    }
  };

  const startChat = (personaIds: string[], title: string, marker: string) => {
    if (!projectId || personaIds.length === 0 || startGroup.isPending) return;
    if (personaIds.some((id) => isInsufficientData(id))) return;
    setPendingId(marker);
    startGroup.mutate(
      { projectId, personaIds, title },
      {
        onSuccess: () => onStarted?.(),
        onError: () => setPendingId(null),
      },
    );
  };

  const toggle = (personaId: string) => {
    if (isInsufficientData(personaId)) return;
    setSelected((prev) => ({ ...prev, [personaId]: !prev[personaId] }));
  };

  // Inline persona rename.
  const updatePersona = usePersonaUpdate(projectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cancelRenameRef = useRef(false);

  const startRename = (id: string, name: string | null) => {
    setEditingId(id);
    setDraft(name ?? "");
  };

  const submitRename = (id: string, currentName: string | null) => {
    const name = draft.trim();
    setEditingId(null);
    if (!name || name.length < 2 || name === (currentName ?? "")) return;
    updatePersona.mutate(
      { personaId: id, personaName: name },
      { onSuccess: () => toast.success("Persona renamed") },
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />}
          iconBg="bg-emerald-100"
          value={summary?.personas_created ?? allPersonas.length}
          label="Personas Created"
          active={panelView === "personas"}
          onClick={() => setPanelView("personas")}
          // Shown from the list too, so only a placeholder while neither is in.
          loading={!summary && dashboardQuery.isLoading && personasQuery.isLoading}
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5 text-red-700" />}
          iconBg="bg-red-100"
          value={summary?.insufficient_data ?? 0}
          label="Insufficient Data"
          active={panelView === "insufficient"}
          onClick={() => setPanelView("insufficient")}
          loading={!summary && dashboardQuery.isLoading}
        />
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5 text-foreground" />}
          iconBg="bg-secondary"
          value={summary?.data_files ?? 0}
          label="Data Files"
          active={panelView === "files"}
          onClick={() => setPanelView("files")}
          loading={!summary && dashboardQuery.isLoading}
        />
      </div>

      {panelView === "files" ? (
        <>
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-sm font-medium text-foreground">
              Data files
              {summary?.data_files ? ` · ${summary.data_files}` : ""}
            </p>
          </div>
          <ScrollArea className={scrollHeight}>
            <ProjectDataFilesList projectId={projectId} />
          </ScrollArea>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-foreground">
                {panelView === "insufficient"
                  ? "Insufficient data personas"
                  : "Personas"}
                {personas.length > 0 ? ` · ${personas.length}` : ""}
              </p>
              {/* Key for the edge tab, only while a marked persona is on screen. */}
              {/* {showsChatPersonas && (
                <span
                  aria-hidden="true"
                  data-testid="chat-personas-legend"
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground duration-200 animate-in fade-in"
                >
                  <span className="h-3 w-[3px] rounded-full bg-primary/70" />
                  Built in this chat
                </span>
              )} */}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={TOOLBAR_CONTROL}>
                    <ArrowDownUp
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Sort: {sortLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={PICK_MENU}>
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(v) => {
                      const next = SORT_OPTIONS.find((o) => o.value === v);
                      if (next) setSort(next.value);
                    }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <DropdownMenuRadioItem
                        key={o.value}
                        value={o.value}
                        className={PICK_ITEM}
                      >
                        {o.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select
                value={sourceFilter}
                onValueChange={(v) =>
                  setSourceFilter(v as "all" | DataSourceKey)
                }
              >
                <SelectTrigger
                  className={cn(TOOLBAR_CONTROL, "[&>svg]:size-3.5")}
                  aria-label="Filter personas by data source"
                >
                  <SelectValue>
                    {sourceFilter === "all" ? (
                      <>
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        All sources
                      </>
                    ) : (
                      (() => {
                        const Icon = DATA_SOURCE_META[sourceFilter].icon;
                        return (
                          <>
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {DATA_SOURCE_META[sourceFilter].short}
                          </>
                        );
                      })()
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="end" className={PICK_MENU}>
                  <SelectItem value="all" className={cn(PICK_ITEM, COUNTED_ITEM)}>
                    All sources
                    <span className="ml-auto pl-4 tabular-nums text-muted-foreground">
                      {allPersonas.length}
                    </span>
                  </SelectItem>
                  {DATA_SOURCE_KEYS.map((key) => (
                    <SelectItem key={key} value={key} className={cn(PICK_ITEM, COUNTED_ITEM)}>
                      {DATA_SOURCE_META[key].label}
                      <span className="ml-auto pl-4 tabular-nums text-muted-foreground">
                        {sourceCounts[key]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div
                role="group"
                aria-label="Persona layout"
                className="inline-flex h-8 items-stretch gap-0.5 rounded-lg bg-muted p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  aria-label="List view"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    view === "list"
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  aria-label="Grid view"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    view === "grid"
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Grid
                </button>
              </div>
            </div>
          </div>

          <ScrollArea className={scrollHeight}>
            {personasQuery.isLoading ? (
              view === "list" ? (
                <div className="flex flex-col gap-2.5 p-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PersonaListRowSkeleton key={`list-skeleton-${i}`} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-4 p-1 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card
                      key={`persona-skeleton-${i}`}
                      className="flex h-[620px] flex-col"
                    >
                      <CardContent className="flex flex-1 flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="mt-auto h-9 w-full rounded-md" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : personasQuery.isError && allPersonas.length === 0 ? (
              // A failed load is not an empty project.
              <EmptyState
                className="h-[400px] justify-center"
                icon={<XCircle className="h-6 w-6" />}
                title="Couldn't load the personas"
                description="Check your connection and try again."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={personasQuery.isFetching}
                    onClick={() => personasQuery.refetch()}
                  >
                    Try again
                  </Button>
                }
              />
            ) : allPersonas.length === 0 ? (
              <EmptyState
                className="h-[400px] justify-center"
                icon={<Users className="h-6 w-6" />}
                title="No personas yet"
                description="Use the persona-builder chat to create personas first."
              />
            ) : personas.length === 0 && panelView === "insufficient" ? (
              <EmptyState
                className="h-[400px] justify-center"
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="No personas with insufficient data"
                description={
                  sourceFilter === "all"
                    ? "Every persona in this project matched enough respondents to chat with."
                    : `No ${DATA_SOURCE_META[sourceFilter].label} persona is short of respondent data.`
                }
              />
            ) : personas.length === 0 ? (
              <EmptyState
                className="h-[400px] justify-center"
                icon={<Filter className="h-6 w-6" />}
                title="No personas from this source"
                description={
                  sourceFilter === "all"
                    ? undefined
                    : `None of this project's personas were built from ${DATA_SOURCE_META[sourceFilter].label}.`
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSourceFilter("all")}
                  >
                    Show all personas
                  </Button>
                }
              />
            ) : view === "list" ? (
              <div className="flex flex-col gap-2.5 p-1">
                {personas.map((persona, index) => {
                  const isSelected = Boolean(selected[persona.persona_id]);
                  const isPending = pendingId === persona.persona_id;
                  const dash = evidenceByPersona.get(persona.persona_id);
                  const isInsufficient = Boolean(dash?.insufficient_data);
                  const coverage = dash?.final_coverage;
                  const hasCoverage =
                    typeof coverage === "number" && coverage > 0;
                  const dashHasEvidence = Boolean(
                    dash &&
                    (dash.study_summary.length > 0 ||
                      dash.evidence_by_category.length > 0),
                  );
                  const isEvidenceOpen = Boolean(
                    openEvidence[persona.persona_id],
                  );
                  const isHighlighted = highlightId === persona.persona_id;
                  const fromThisChat = Boolean(chatPersonaIds?.has(persona.persona_id));
                  return (
                    <div
                      key={persona.persona_id}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      aria-current={isHighlighted ? "true" : undefined}
                      data-from-chat={fromThisChat || undefined}
                      // Rows arrive one after another, like the grid's cards.
                      style={{
                        animationDelay: `${Math.min(index, 12) * 40}ms`,
                        animationFillMode: "backwards",
                      }}
                      className={cn(
                        "relative scroll-mt-1 rounded-xl border bg-card ring-1 ring-foreground/5 transition-[box-shadow,background-color,border-color] duration-300 hover:shadow-md",
                        "animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none",
                         fromThisChat ? "bg-emerald-100/50 border border-emerald-700/20 border-l-4 border-l-emerald-600" : "bg-card",
                        isHighlighted && "border-primary/30 bg-primary/[0.03]",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      {/* {fromThisChat && <FromThisChatEdge />} */}
                      <div className="flex items-center gap-3 p-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={
                                isInsufficient
                                  ? "cursor-not-allowed"
                                  : undefined
                              }
                            >
                              <Checkbox
                                className="border border-gray-200 shadow"
                                checked={isSelected}
                                disabled={isInsufficient}
                                onCheckedChange={() =>
                                  toggle(persona.persona_id)
                                }
                                aria-label={`Select ${persona.persona_name ?? "persona"}`}
                              />
                            </span>
                          </TooltipTrigger>
                          {isInsufficient && (
                            <TooltipContent className="max-w-xs text-left leading-relaxed">
                              {INSUFFICIENT_DATA_TOOLTIP}
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {personaInitials(persona.persona_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {editingId === persona.persona_id ? (
                            <input
                              autoFocus
                              value={draft}
                              maxLength={150}
                              disabled={updatePersona.isPending}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelRenameRef.current = true;
                                  e.currentTarget.blur();
                                }
                              }}
                              onBlur={() => {
                                if (cancelRenameRef.current) {
                                  cancelRenameRef.current = false;
                                  setEditingId(null);
                                  return;
                                }
                                submitRename(
                                  persona.persona_id,
                                  persona.persona_name,
                                );
                              }}
                              className="w-full rounded-md border border-input bg-background px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            />
                          ) : (
                            <div className="group/name flex items-center gap-2">
                              <p
                                className="truncate text-sm font-semibold text-foreground"
                                title={
                                  persona.persona_name ?? "Untitled persona"
                                }
                              >
                                {persona.persona_name ?? "Untitled persona"}
                              </p>
                              <button
                                type="button"
                                aria-label="Rename persona"
                                onClick={() =>
                                  startRename(
                                    persona.persona_id,
                                    persona.persona_name,
                                  )
                                }
                                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/name:opacity-100"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              { fromThisChat && (
                                <p className="text-xs bg-emerald-200/60 text-emerald-900 font-semibold border border-emerald-600/30 rounded-full px-3 py-0.5">
                                  Built-in
                                </p>
                              )}
                            </div>
                          )}
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <DataSourceBadge source={persona.data_source} />
                            {isInsufficient ? (
                              <InsufficientDataBadge />
                            ) : (
                              <span className="capitalize">
                                {persona.status}
                              </span>
                            )}
                            {dash && dash.unique_studies > 0 && (
                              <>
                                <span aria-hidden>·</span>
                                <span>
                                  {dash.unique_studies}{" "}
                                  {dash.unique_studies === 1
                                    ? "study"
                                    : "studies"}
                                </span>
                              </>
                            )}
                            {dash && dash.unique_respondents > 0 && (
                              <>
                                <span aria-hidden>·</span>
                                <span>
                                  {dash.unique_respondents.toLocaleString()}{" "}
                                  respondents
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {hasCoverage && (
                          <div className="hidden w-36 shrink-0 sm:block">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Coverage
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="What does coverage mean?"
                                      className="text-muted-foreground/70 transition-colors hover:text-foreground"
                                    >
                                      <Info className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-left leading-relaxed">
                                    {COVERAGE_HOVER_TEXT}
                                  </TooltipContent>
                                </Tooltip>
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-foreground">
                                {Math.round(coverage as number)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-secondary">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all",
                                  coverageColor(coverage as number),
                                )}
                                style={{ width: `${coverage}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {!dash && dashboardQuery.isLoading && (
                          <div className="hidden w-36 shrink-0 sm:block">
                            <Skeleton className="mb-1 h-2.5 w-16" />
                            <Skeleton className="h-1.5 w-full rounded-full" />
                          </div>
                        )}
                        {dashHasEvidence && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleEvidence(persona.persona_id)}
                            aria-expanded={isEvidenceOpen}
                          >
                            Evidence
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                isEvidenceOpen && "rotate-180",
                              )}
                            />
                          </Button>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "shrink-0",
                                isInsufficient && "cursor-not-allowed",
                              )}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled={
                                  isInsufficient || startGroup.isPending
                                }
                                onClick={() =>
                                  startChat(
                                    [persona.persona_id],
                                    persona.persona_name ?? "Persona",
                                    persona.persona_id,
                                  )
                                }
                              >
                                {isPending ? (
                                  <CircularLoader size="sm" />
                                ) : (
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                )}
                                Chat
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {isInsufficient && (
                            <TooltipContent className="max-w-xs text-left leading-relaxed">
                              {INSUFFICIENT_DATA_TOOLTIP}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                      {dashHasEvidence && (
                        <Collapse open={isEvidenceOpen} className="border-t p-3">
                          <PersonaEvidence
                            data={dash}
                            showCoverage={false}
                            evidenceCols={2}
                            collapsible={false}
                          />
                        </Collapse>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 p-1 md:grid-cols-3">
                {personas.map((persona, index) => {
                  const isSelected = Boolean(selected[persona.persona_id]);
                  const isPending = pendingId === persona.persona_id;
                  const rowIndex = Math.floor(index / columns);
                  const isExpanded = Boolean(expandedRows[rowIndex]);
                  const dash = evidenceByPersona.get(persona.persona_id);
                  const isInsufficient = Boolean(dash?.insufficient_data);
                  const fromThisChat = Boolean(chatPersonaIds?.has(persona.persona_id));
                  return (
                    <Card
                      key={persona.persona_id}
                      data-from-chat={fromThisChat || undefined}
                      style={{
                        animationDelay: `${Math.min(index, 12) * 40}ms`,
                        animationFillMode: "backwards",
                      }}
                      className={cn(
                        "relative flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 hover:shadow-md",
                        // Collapsed: fixed height, evidence scrolls inside. Expanded:
                        // drop the cap and stretch to the row's tallest card so every
                        // card in the row ends up the same height.
                        isExpanded ? "self-stretch" : "h-[620px]",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      {/* {fromThisChat && <FromThisChatEdge />} */}
                      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                              {personaInitials(persona.persona_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              {editingId === persona.persona_id ? (
                                <input
                                  autoFocus
                                  value={draft}
                                  maxLength={150}
                                  disabled={updatePersona.isPending}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelRenameRef.current = true;
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (cancelRenameRef.current) {
                                      cancelRenameRef.current = false;
                                      setEditingId(null);
                                      return;
                                    }
                                    submitRename(
                                      persona.persona_id,
                                      persona.persona_name,
                                    );
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                />
                              ) : (
                                <div className="group/name flex items-start gap-1">
                                  <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-foreground">
                                    {persona.persona_name ?? "Untitled persona"}
                                  </p>
                                  <button
                                    type="button"
                                    aria-label="Rename persona"
                                    onClick={() =>
                                      startRename(
                                        persona.persona_id,
                                        persona.persona_name,
                                      )
                                    }
                                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/name:opacity-100"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <DataSourceBadge source={persona.data_source} />
                                {isInsufficient ? (
                                  <InsufficientDataBadge />
                                ) : (
                                  <span className="capitalize">
                                    {persona.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={
                                  isInsufficient
                                    ? "cursor-not-allowed"
                                    : undefined
                                }
                              >
                                <Checkbox
                                  className="border border-gray-200 shadow"
                                  checked={isSelected}
                                  disabled={isInsufficient}
                                  onCheckedChange={() =>
                                    toggle(persona.persona_id)
                                  }
                                  aria-label={`Select ${persona.persona_name ?? "persona"}`}
                                />
                              </span>
                            </TooltipTrigger>
                            {isInsufficient && (
                              <TooltipContent className="max-w-xs text-left leading-relaxed">
                                {INSUFFICIENT_DATA_TOOLTIP}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>

                        {!isBuilderPersona(persona) &&
                          evidenceByPersona.get(persona.persona_id)
                            ?.final_coverage == null && (
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Coverage
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "shrink-0",
                                    confidenceColors[persona.confidence],
                                  )}
                                >
                                  {persona.confidence}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 rounded-full bg-secondary">
                                  <div
                                    className={cn(
                                      "h-2 rounded-full transition-all animate-[coverage-grow_0.8s_ease-out]",
                                      coverageColor(persona.coverage),
                                    )}
                                    style={{ width: `${persona.coverage}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold tabular-nums text-foreground">
                                  {persona.coverage}%
                                </span>
                              </div>
                            </div>
                          )}

                        {dash ? (
                          <PersonaEvidence
                            data={dash}
                            className="border-t pt-3"
                            expanded={isExpanded}
                            onExpandedChange={(next) =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [rowIndex]: next,
                              }))
                            }
                          />
                        ) : dashboardQuery.isLoading ? (
                          <EvidenceSkeleton />
                        ) : null}

                        <div className="mt-auto pt-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={cn(
                                  "block",
                                  isInsufficient && "cursor-not-allowed",
                                )}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  disabled={
                                    isInsufficient || startGroup.isPending
                                  }
                                  onClick={() =>
                                    startChat(
                                      [persona.persona_id],
                                      persona.persona_name ?? "Persona",
                                      persona.persona_id,
                                    )
                                  }
                                >
                                  {isPending ? (
                                    <CircularLoader size="sm" />
                                  ) : (
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                  )}
                                  Chat
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {isInsufficient && (
                              <TooltipContent className="max-w-xs text-left leading-relaxed">
                                {INSUFFICIENT_DATA_TOOLTIP}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {panelView === "personas" && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-3">
                {personas.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all personas"
                    />
                    Select all
                  </label>
                )}
                <span className="text-xs text-muted-foreground">
                  {selectedPersonas.length > 0
                    ? `${selectedPersonas.length} selected`
                    : "Select personas to start a group chat"}
                </span>
              </div>
              <Button
                disabled={selectedPersonas.length === 0 || startGroup.isPending}
                onClick={() =>
                  startChat(
                    selectedPersonas.map((p) => p.persona_id),
                    groupChatTitle(
                      selectedPersonas.map((p) => p.persona_name ?? "Persona"),
                    ),
                    "group",
                  )
                }
              >
                {pendingId === "group" ? (
                  <CircularLoader size="sm" className="border-white" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Start Group Chat
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default PersonaPanel;
