import { memo } from "react";

import { Message } from "@/components/ui/message";
import { cn } from "@/lib/utils";
import BuilderAvatar from "./BuilderAvatar";
import { CHAT_COLUMN } from "./chatLayout";
import { usePhraseIndex } from "./LoadingMessage";

type BuilderThinkingProps = {
  /**
   * Status lines shown in turn while waiting; the last one stays up for as long
   * as the wait lasts (same pacing as LoadingMessage).
   */
  phrases: readonly string[];
  /** What screen readers hear, once. The rotating lines are visual only. */
  label: string;
};

/**
 * The persona builder "typing": its avatar blinking beside a bubble with the
 * current status line. Sits where the builder's reply will appear, so the
 * reply lands in the same place.
 */
const BuilderThinking = memo(({ phrases, label }: BuilderThinkingProps) => {
  const lines = phrases.length > 0 ? phrases : ["Thinking…"];
  const index = usePhraseIndex(lines.length, lines.join("\u0000"));

  return (
    <Message
      className={cn(
        CHAT_COLUMN,
        "items-start gap-3 px-2 duration-300 animate-in fade-in slide-in-from-left-2 motion-reduce:animate-none md:px-10",
      )}
    >
      <BuilderAvatar active />
      <div
        role="status"
        className="flex min-h-9 items-center gap-2.5 rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2"
      >
        <span className="sr-only">{label}</span>
        {/* Keyed by line, so each new one fades in rather than swapping in place. */}
        <span
          key={index}
          aria-hidden="true"
          data-testid="builder-thinking-phrase"
          className="text-sm text-muted-foreground duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {lines[index]}
        </span>
      </div>
    </Message>
  );
});

BuilderThinking.displayName = "BuilderThinking";

export default BuilderThinking;
