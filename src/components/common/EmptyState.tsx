import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import AuroraBackground from "@/components/global/AuroraBackground";

type EmptyStateProps = {
  /** Icon shown in the brand-tinted badge. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. a button). */
  action?: ReactNode;
  className?: string;
};

/**
 * Friendly, on-brand zero/empty state: a gradient icon badge, title,
 * description and an optional action. Used wherever a list has no items.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden px-6 py-12 text-center duration-300 animate-in fade-in",
        className,
      )}
    >
      <AuroraBackground className="opacity-50" />
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eef1ff] to-[#e8ecff] text-[#6338F6] ring-1 ring-primary/10 dark:from-primary/15 dark:to-primary/5">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
