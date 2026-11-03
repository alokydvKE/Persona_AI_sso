import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import EmptyState from "@/components/common/EmptyState";
import { COVERAGE_HOVER_TEXT, coverageColor } from "./PersonaEvidence";

import { useBuilderPersonas, type BuildResultPersona } from "@/api/Persona/query";
import { useStartGroupChat } from "@/api/GroupChat/mutation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { groupChatTitle } from "@/lib/chatTitles";
import { personaColorStyle, personaInitials } from "@/lib/personaColors";
import { cn } from "@/lib/utils";

/** Wide enough to sit beside the chat; below this the panel overlays it. */
const INLINE_QUERY = "(min-width: 1024px)";
const PANEL_WIDTH = "w-[22rem]";

const INSUFFICIENT_DATA_TOOLTIP = "This persona doesn't have sufficient respondent data.";
const ANALYSING_TOOLTIP = "Available once the build finishes analysing the data.";

/** Where a persona stands; decides what its card shows and allows. */
type PersonaState = "analysing" | "insufficient" | "no-data" | "ready";

function personaState(p: BuildResultPersona, building: boolean): PersonaState {
  if (p.insufficient_data) return "insufficient";
  if (!p.has_query_results) return building ? "analysing" : "no-data";
  return "ready";
}

/** Analysing and too-thin personas can't join a chat. */
const canChat = (state: PersonaState) => state === "ready" || state === "no-data";

const personaName = (p: BuildResultPersona) => p.persona_name?.trim() || "Untitled persona";

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

type BuildResultsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  /** Show this persona in the persona dashboard, with its evidence open. */
  onOpenPersona: (personaId: string) => void;
};

/**
 * The personas this builder chat built — study and respondent counts and
 * coverage, with a group chat for the ticked ones. A card opens that persona
 * in the persona dashboard. Scoped to the chat, not the project.
 *
 * On wide screens it is a column of the chat layout that slides open beside
 * the transcript (like the app sidebar) rather than covering it; on narrow
 * ones, where there is no room for a column, it overlays as a sheet.
 */
function BuildResultsPanel(props: BuildResultsPanelProps) {
  const inline = useMediaQuery(INLINE_QUERY);
  return inline ? <InlinePanel {...props} /> : <OverlayPanel {...props} />;
}

function InlinePanel({ open, onOpenChange, ...content }: BuildResultsPanelProps) {
  const asideRef = useRef<HTMLElement>(null);
  // Mounted on first open, then kept, so closing animates with its content
  // in place and reopening doesn't reset ticks or scroll.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  // Move focus into the panel when it opens, and hand it back to whatever
  // opened it when it closes (if focus was still inside).
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      aside.focus({ preventScroll: true });
    } else if (aside.contains(document.activeElement)) {
      returnFocusRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <aside
      ref={asideRef}
      tabIndex={-1}
      aria-label="Build results"
      inert={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onOpenChange(false);
        }
      }}
      className={cn(
        "h-full shrink-0 overflow-hidden bg-white outline-none transition-[width,border-color] duration-300 ease-in-out motion-reduce:transition-none dark:bg-background",
        open ? PANEL_WIDTH : "w-0 border-transparent",
      )}
    >
      {/* Fixed width inside, so the content doesn't reflow while it slides. */}
      <div className={cn("flex h-full flex-col", PANEL_WIDTH)}>
        {mounted && <BuildResults {...content} />}
      </div>
    </aside>
  );
}

function OverlayPanel({ open, onOpenChange, onOpenPersona, ...content }: BuildResultsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 bg-white p-0 sm:max-w-[22rem] dark:bg-background"
      >
        <BuildResults
          {...content}
          // The dashboard is a dialog of its own; don't stack it on this one.
          onOpenPersona={(id) => {
            onOpenChange(false);
            onOpenPersona(id);
          }}
          inSheet
        />
      </SheetContent>
    </Sheet>
  );
}

function BuildResults({
  conversationId,
  onOpenPersona,
  inSheet = false,
}: Omit<BuildResultsPanelProps, "open" | "onOpenChange"> & {
  /** Rendered in the overlay sheet, whose title/description name the dialog. */
  inSheet?: boolean;
}) {
  const query = useBuilderPersonas(conversationId);
  const startGroup = useStartGroupChat();
  // Everyone who can chat starts ticked; tracking the unticked instead means
  // personas that finish analysing while the panel is open join by default.
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());

  const data = query.data;
  const building = data?.build?.status === "queued" || data?.build?.status === "running";

  const rows = useMemo(
    () => (data?.personas ?? []).map((p) => ({ persona: p, state: personaState(p, building) })),
    [data?.personas, building],
  );
  const chattable = rows.filter((r) => canChat(r.state)).map((r) => r.persona);
  const selected = chattable.filter((p) => !unticked.has(p.persona_id));

  const toggle = (id: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const startGroupChat = () => {
    if (!data || selected.length === 0 || startGroup.isPending) return;
    startGroup.mutate({
      projectId: data.project_id,
      personaIds: selected.map((p) => p.persona_id),
      title: groupChatTitle(selected.map(personaName)),
    });
    // Navigation to the new chat happens in the mutation itself.
  };

  const description = !data
    ? query.isError
      ? "Couldn't load the results."
      : "Loading the personas from this chat…"
    : building
      ? `${count(data.summary.personas_created, "persona")} · analysing the data…`
      : `${count(data.summary.personas_created, "persona")} created · ${data.summary.insufficient_data} with insufficient data`;

  const allSelected = selected.length > 0 && selected.length === chattable.length;
  const startLabel =
    selected.length === 0
      ? "Start group chat"
      : selected.length === 1
        ? "Start chat with 1 persona"
        : allSelected
          ? `Start group chat with all ${selected.length}`
          : `Start group chat with ${selected.length}`;
  // Only when the button can't be used, to say why.
  const hint = building
    ? "Chats open once the build finishes analysing the data."
    : chattable.length === 0
      ? "None of these personas have enough data to chat with."
      : selected.length === 0
        ? "Tick at least one persona to start a chat."
        : null;

  const titleClass = "text-[15px] font-semibold leading-tight text-foreground";
  const descriptionClass = "mt-1 text-[11px] text-muted-foreground";

  return (
    <>
      {/* Right padding in the sheet keeps the title clear of its close button. */}
      <div className={cn("px-4 pt-4 pb-3", inSheet && "pr-12")}>
        <div className="min-w-0">
          {inSheet ? (
            <>
              <SheetTitle className={titleClass}>Build results</SheetTitle>
              <SheetDescription className={descriptionClass}>{description}</SheetDescription>
            </>
          ) : (
            <>
              <h2 className={titleClass}>Build results</h2>
              <p className={descriptionClass}>{description}</p>
            </>
          )}
        </div>
      </div>

      {/* Radix wraps the list in a display:table div that grows to fit its
          widest line, which pushed long (truncated) names past the right
          edge. Block keeps every card at the panel's width. */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {query.isPending ? (
            [0, 1, 2].map((i) => <ResultCardSkeleton key={i} />)
          ) : !data ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load this build's personas"
              description="Check your connection and try again."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.isFetching}
                  onClick={() => query.refetch()}
                >
                  {query.isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Try again
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={data.build ? "No personas in this build" : "No personas yet"}
              description={
                data.build
                  ? "They may have been deleted from the project."
                  : "Personas appear here once this chat finishes building them."
              }
            />
          ) : (
            rows.map(({ persona, state }, index) => (
              <ResultCard
                key={persona.persona_id}
                // Cards arrive one after another; later refreshes keep their keys
                // and don't replay it.
                enterDelayMs={Math.min(index, 8) * 60}
                persona={persona}
                state={state}
                selected={canChat(state) && !unticked.has(persona.persona_id)}
                onToggle={() => toggle(persona.persona_id)}
                onOpen={() => onOpenPersona(persona.persona_id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {data && rows.length > 0 && (
        <div className="border-t bg-white px-4 pt-3 pb-3 dark:bg-background">
          <Button
            className="h-10 w-full rounded-lg text-[13px] font-semibold shadow-lg shadow-primary/25"
            disabled={selected.length === 0 || startGroup.isPending}
            onClick={startGroupChat}
          >
            {startGroup.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Users aria-hidden="true" />
            )}
            {startLabel}
          </Button>
          {hint && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      )}
    </>
  );
}

function ResultCard({
  persona,
  state,
  selected,
  onToggle,
  onOpen,
  enterDelayMs = 0,
}: {
  persona: BuildResultPersona;
  state: PersonaState;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  enterDelayMs?: number;
}) {
  const name = personaName(persona);
  const style = personaColorStyle(persona.color);
  const chattable = canChat(state);
  const blockedReason =
    state === "insufficient"
      ? INSUFFICIENT_DATA_TOOLTIP
      : state === "analysing"
        ? ANALYSING_TOOLTIP
        : null;
  const coverage =
    typeof persona.final_coverage === "number" && Number.isFinite(persona.final_coverage)
      ? Math.min(Math.max(persona.final_coverage, 0), 100)
      : null;

  return (
    // The name's button stretches over the whole card (its ::after), so any
    // click opens the persona; the checkbox sits above that layer.
    <div
      style={{ animationDelay: `${enterDelayMs}ms`, animationFillMode: "backwards" }}
      className={cn(
        "relative min-w-0 rounded-xl border p-3 transition-[border-color,background-color,box-shadow] duration-200",
        "animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none",
        selected ? "border-primary/20 bg-primary/[0.04]" : "bg-white dark:bg-card",
        "hover:border-primary/40 hover:shadow-sm",
        "has-[[data-card-open]:focus-visible]:ring-2 has-[[data-card-open]:focus-visible]:ring-ring/50",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative z-10 mt-2.5 flex">
          <WithReason reason={blockedReason}>
            <Checkbox
              checked={selected}
              disabled={!chattable}
              onCheckedChange={onToggle}
              aria-label={`Include ${name} in the group chat`}
            />
          </WithReason>
        </span>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-inset ring-black/5",
            style.avatar,
          )}
          aria-hidden="true"
        >
          {personaInitials(name)}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <button
            type="button"
            data-card-open
            title="View this persona's evidence"
            onClick={onOpen}
            className="block w-full truncate text-left text-[13px] font-semibold leading-tight text-foreground outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
          >
            {name}
          </button>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {state === "analysing" ? (
              <span className="animate-pulse">Analysing data…</span>
            ) : state === "no-data" ? (
              "No study data yet"
            ) : (
              <>
                {state === "insufficient" && (
                  <span className="font-medium text-red-600">Insufficient data · </span>
                )}
                {count(persona.unique_studies, "study", "studies")} ·{" "}
                {count(persona.unique_respondents, "respondent")}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <span
          className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          title={COVERAGE_HOVER_TEXT}
        >
          Coverage
        </span>
        {state === "analysing" ? (
          <Skeleton className="h-1 flex-1 rounded-full" />
        ) : (
          <div
            className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label={`Coverage for ${name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={coverage === null ? undefined : Math.round(coverage)}
          >
            {coverage !== null && (
              <div
                className={cn(
                  "h-full rounded-full animate-[coverage-grow_0.8s_ease-out]",
                  coverageColor(coverage),
                )}
                style={{ width: `${coverage}%` }}
              />
            )}
          </div>
        )}
        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
          {coverage === null ? "—" : `${Math.round(coverage)}%`}
        </span>
      </div>
    </div>
  );
}

/**
 * Explains a disabled control on hover. Disabled controls swallow pointer
 * events, so the tooltip hangs off a wrapper instead.
 */
function WithReason({ reason, children }: { reason: string | null; children: React.ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex cursor-not-allowed">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-relaxed">{reason}</TooltipContent>
    </Tooltip>
  );
}

function ResultCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-3 dark:bg-card" aria-hidden="true">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="size-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-1 w-full rounded-full" />
    </div>
  );
}

export default BuildResultsPanel;
