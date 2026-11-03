import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardPersona } from "@/api/Persona/query";

/** Coverage-bar fill colour by percentage band (mirrors the persona cards). */
export function coverageColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 70) return "bg-sky-500";
  return "bg-amber-500";
}

/** Explanation shown on hover of the Coverage label (dashboard + sidebar). */
export const COVERAGE_HOVER_TEXT =
  "Coverage estimates how well the available survey evidence supports this persona. " +
  "It combines demographic match quality, matched respondent sample size, evidence strength, " +
  "and breadth of evidence across requested characteristics and behaviors. This is an evidence " +
  "coverage score, not a guarantee that every written requirement is fully answered.";

/** Friendly labels for known study_type_ids; falls back to a humanised id. */
const STUDY_TYPE_LABELS: Record<string, string> = {
  ua: "U&A",
  price_pack: "Price-Pack",
  claims: "Claims",
};

function formatStudyType(id: string): string {
  const key = id.toLowerCase().replace(/[\s-]+/g, "_");
  if (STUDY_TYPE_LABELS[key]) return STUDY_TYPE_LABELS[key];
  return id
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * run_query output for one persona: matched N per study and the evidence grouped
 * by category (theme name -> labelled items with support %). Shared by the
 * persona dashboard cards and the group-chat participant detail sheet. Renders
 * nothing until the persona_query job has populated this persona.
 */
function PersonaEvidence({
  data,
  className,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  showCoverage = true,
  evidenceCols = 1,
  collapsible = true,
}: {
  data?: DashboardPersona;
  className?: string;
  /** Start with all evidence categories expanded (used in the sidebar, where
   * space is ample); the dashboard cards default to the collapsed view. */
  defaultExpanded?: boolean;
  /** Controlled expand state. When provided (the dashboard, which also grows the
   * fixed-height card on expand), the parent owns it; otherwise the component
   * keeps its own state seeded by defaultExpanded (the sidebar). */
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  /** Render the coverage bar. The list view hides it (the row shows its own). */
  showCoverage?: boolean;
  /** Evidence-category blocks per row: 1 (narrow cards/sidebar) or 2 (the wide
   * list dropdown). */
  evidenceCols?: 1 | 2;
  /** Show the internal Expand/Collapse toggle. The list dropdown sets this false
   * — its row-level "Evidence" button already controls the panel — so the panel
   * just shows everything. */
  collapsible?: boolean;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  // Non-collapsible (list dropdown): always fully expanded, no inner toggle.
  const expanded = collapsible ? expandedProp ?? internalExpanded : true;
  const setExpanded = (next: boolean) => {
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
  };

  // Whether the collapsed (height-capped) evidence block actually overflows —
  // only then is an Expand toggle useful. Measured after layout so we don't show
  // it for personas whose evidence already fits.
  const evidenceRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const categories = data?.evidence_by_category ?? [];

  useLayoutEffect(() => {
    const el = evidenceRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    // The collapsed block flex-fills the fixed-height card, so its available
    // height can change (e.g. a wrapping name, viewport resize) — re-measure on
    // resize so the Expand toggle only shows when content is actually clipped.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories, expanded]);

  if (!data) return null;

  const hasStudies = data.study_summary.length > 0;
  const hasEvidence = categories.length > 0;
  const coverage = data.final_coverage;
  const hasCoverage = showCoverage && typeof coverage === "number" && coverage > 0;
  if (!hasStudies && !hasEvidence && !hasCoverage) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        // Fill the card down to the Chat button so the collapsed evidence block
        // has no dead space beneath it.
        !expanded && hasEvidence && "min-h-0 flex-1",
        className,
      )}
    >
      {/* Matched N across studies (study_summary). */}
      {hasStudies && (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Matched N (across studies)
          </p>
          <div className="flex flex-wrap gap-2">
            {data.study_summary.map((study) => (
              <span
                key={study.study_type_id}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {formatStudyType(study.study_type_id)} n={study.unique_respondent_count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Coverage (run_query final_coverage) as a percentage bar. */}
      {hasCoverage && (
        <div>
          <div className="mb-2 flex items-center gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coverage
            </span>
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
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-secondary">
              <div
                className={cn(
                  "h-2 rounded-full transition-all animate-[coverage-grow_0.8s_ease-out]",
                  coverageColor(coverage as number),
                )}
                style={{ width: `${coverage}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {Math.round(coverage as number)}%
            </span>
          </div>
        </div>
      )}

      {/* Evidence grouped by category/theme (final_evidence_by_category). */}
      {hasEvidence && (
        <div className={cn("flex flex-col", !expanded && "min-h-0 flex-1")}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence by category
          </p>
          <div
            ref={evidenceRef}
            className={cn(
              // 2 blocks per row in the wide list dropdown; a single column in the
              // narrow cards / sidebar.
              evidenceCols === 2
                ? "grid grid-cols-1 items-start gap-2 sm:grid-cols-2"
                : "flex flex-col gap-2",
              // Collapsed by default: fill the remaining card height and scroll the
              // overflow, so the evidence reaches down to the Chat button with no
              // dead space, and cards stay aligned regardless of how much each has.
              !expanded && "min-h-0 flex-1 overflow-y-auto pr-1",
            )}
          >
            {categories.map((category) => (
              <div key={category.theme_id} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {category.theme_name}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {category.items.map((item, index) => (
                    <li
                      key={`${category.theme_id}-${index}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="text-xs text-foreground">{item.label}</span>
                      {item.support_pct != null && (
                        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                          {Math.round(item.support_pct)}%
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {collapsible && (expanded || overflowing) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 inline-flex items-center gap-0.5 self-start text-xs font-semibold text-primary hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? "Collapse" : "Expand"}
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PersonaEvidence;
