import { useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Floating "jump to latest" control. Rendered inside the chat scroll container
 * (so it can read StickToBottom's context); only shown when scrolled up.
 */
function ChatScrollButton({ className }: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;

  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      aria-label="Scroll to latest"
      className={cn(
        "sticky bottom-2 z-20 flex size-9 items-center justify-center self-center rounded-full border border-border bg-popover/90 text-foreground shadow-lg backdrop-blur transition-colors duration-200 animate-in fade-in zoom-in-95 hover:bg-popover",
        className,
      )}
    >
      <ArrowDown className="size-4" />
    </button>
  );
}

export default ChatScrollButton;
