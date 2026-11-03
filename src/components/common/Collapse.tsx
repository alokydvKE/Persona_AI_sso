import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  /** Classes for the content box (padding, borders…), not the animated shell. */
  className?: string;
};

/**
 * Slides its content open and closed by height. The shell animates its grid
 * row between 0fr and 1fr, which tracks the content's real height without
 * measuring it. Content mounts on first open and then stays, so closing
 * animates too; while closed it is inert (out of the tab order and hidden
 * from assistive tech).
 */
function Collapse({ open, children, className }: CollapseProps) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  return (
    <div
      inert={!open}
      data-state={open ? "open" : "closed"}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {mounted && <div className={className}>{children}</div>}
      </div>
    </div>
  );
}

export default Collapse;
