import { Check, Database, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DataSourceKey, DataSourceOption } from "@/api/Chat/query";
import { DATA_SOURCE_META } from "./DataSourceBadge";

type Props = {
  options: DataSourceOption[];
  value: DataSourceKey | null;
  onChange: (key: DataSourceKey) => void;
  /** Renders the whole group read-only (the build has started, or a call is in flight). */
  disabled?: boolean;
  isLoading?: boolean;
};

/**
 * The data-source picker's rows — which dataset a persona build reads.
 *
 * Rendered as a radio GROUP rather than a `<select>` on purpose: each option
 * carries a sentence of explanation, and the ones this project cannot use yet
 * are shown greyed out with the reason attached. A dropdown hides exactly the
 * information the user needs to choose, and gives an unavailable option nowhere
 * to put its "why".
 *
 * Unavailable options stay in the list instead of being filtered out: a user who
 * uploaded data and does not see it here needs to know it is still processing,
 * not that the option vanished.
 */
function DataSourceOptionList({
  options,
  value,
  onChange,
  disabled = false,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading data options…
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Data source"
      className="flex flex-col gap-2"
    >
      {options.map((option) => {
        const Icon = DATA_SOURCE_META[option.key]?.icon ?? Database;
        const selected = value === option.key;
        const locked = disabled || !option.available;

        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50",
              locked && "cursor-not-allowed opacity-60 hover:bg-transparent",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                selected ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                {selected && (
                  <Check
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.description}
              </span>
              {/* Why this row is greyed out. Backend copy, so the reason stays
                  accurate as the pipeline's states change. */}
              {!option.available && option.reason_message && (
                <span className="mt-1 block text-xs font-medium text-amber-600 dark:text-amber-500">
                  {option.reason_message}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default DataSourceOptionList;
