import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { CHAT_COLUMN, CHAT_INSET } from "./chatLayout";

type ChatEndedProps = {
  /** Copy describing the ended state (e.g. conversation vs. discussion). */
  message?: string;
  /** Optional way forward, shown as a link on the right (e.g. "Start a new build"). */
  action?: { label: string; onClick: () => void };
  className?: string;
};

/**
 * Reusable end-of-conversation bar.
 *
 * Shown once a builder/group chat is closed and no further messages are
 * accepted: a soft rounded bar in the chat column above the (disabled)
 * composer, with an optional next step on the right.
 */
function ChatEnded({
  message = "This conversation has ended",
  action,
  className,
}: ChatEndedProps) {
  return (
    <div className={cn(CHAT_COLUMN, CHAT_INSET, "pb-2", className)}>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ececf2] bg-[#f5f5f8] px-4 py-2.5 duration-300 animate-in fade-in dark:border-border dark:bg-muted">
        <span className="flex min-w-0 items-center gap-2.5">
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span role="status" aria-live="polite" className="truncate text-[13px] font-medium text-foreground/80">
            {message}
          </span>
        </span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 rounded-sm text-[13px] font-semibold text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatEnded;
