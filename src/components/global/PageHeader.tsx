import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeaderSlotsContext } from "./pageHeaderSlots";

/*
 * Lets a page put its own title and actions into the app's top bar.
 *
 * The root layout renders two empty slots in its header and publishes them via
 * PageHeaderSlotsContext; a page renders <PageHeaderTitle> / <PageHeaderActions>
 * anywhere in its tree and the content is portalled into those slots. It stays
 * part of the page's React tree, so it keeps the page's state, handlers and
 * context.
 *
 * Without a layout (a page rendered on its own, e.g. in tests) the content
 * renders in place instead, so nothing ever silently disappears.
 */

function Slot({ target, children }: { target: HTMLElement | null | undefined; children: ReactNode }) {
  const slots = useContext(PageHeaderSlotsContext);
  if (!slots) return <>{children}</>;
  // The slot element mounts with the layout; until then there is nowhere to go.
  if (!target) return null;
  return createPortal(children, target);
}

/** Tone of the status pill next to the title. */
export type PageStatusTone = "success" | "progress" | "neutral";

const STATUS_TONES: Record<PageStatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", dot: "bg-emerald-500" },
  progress: { pill: "bg-primary/10 text-primary ring-primary/20", dot: "bg-primary animate-pulse" },
  neutral: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" },
};

/**
 * The current page's name, shown after the project name in the top bar
 * ("project › title"), with an optional status pill.
 */
export function PageHeaderTitle({
  title,
  status,
}: {
  title: string | undefined;
  status?: { label: string; tone: PageStatusTone };
}) {
  const slots = useContext(PageHeaderSlotsContext);
  if (!title && !status) return null;
  const tone = status ? STATUS_TONES[status.tone] : null;
  return (
    <Slot target={slots?.title}>
      <span className="flex min-w-0 items-center gap-2">
        {title && (
          <>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            {/* Capped so a long name cuts off early instead of filling the
                bar; the full name shows on hover. */}
            <span
              className="max-w-[min(28rem,40vw)] truncate text-sm font-semibold text-foreground"
              title={title}
            >
              {title}
            </span>
          </>
        )}
        {status && tone && (
          <span
            role="status"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              tone.pill,
            )}
          >
            <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />
            {status.label}
          </span>
        )}
      </span>
    </Slot>
  );
}

/** Buttons and controls shown on the right of the top bar for this page. */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const slots = useContext(PageHeaderSlotsContext);
  return (
    <Slot target={slots?.actions}>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </Slot>
  );
}
