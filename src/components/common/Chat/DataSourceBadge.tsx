import { Database, Layers, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DataSourceKey } from "@/api/Chat/query";

/**
 * Display metadata per dataset key — the one place the icon/label/colour of a
 * data source is defined, shared by the builder's picker and the persona
 * dashboard so a source looks the same everywhere.
 */
export const DATA_SOURCE_META: Record<
  DataSourceKey,
  { label: string; short: string; icon: typeof Database; className: string }
> = {
  master: {
    label: "Master data",
    short: "Master",
    icon: Database,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  uploaded: {
    label: "My uploaded data",
    short: "Uploaded",
    icon: Upload,
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  combined: {
    label: "Master + my uploaded data",
    short: "Master + Uploaded",
    icon: Layers,
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
};

/** Ordered keys, matching the backend registry (persona_data_sources.py). */
export const DATA_SOURCE_KEYS: DataSourceKey[] = [
  "master",
  "uploaded",
  "combined",
];

/** Icon-only chip for the dataset a persona was built from; the name shows on hover. */
function DataSourceBadge({
  source,
  className,
}: {
  source: DataSourceKey | null | undefined;
  className?: string;
}) {
  const meta = DATA_SOURCE_META[source ?? "master"] ?? DATA_SOURCE_META.master;
  const Icon = meta.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "h-5 w-5 shrink-0 cursor-default justify-center rounded-full p-0",
            meta.className,
            className,
          )}
          aria-label={`Built from ${meta.label}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Built from {meta.label}</TooltipContent>
    </Tooltip>
  );
}

export default DataSourceBadge;
