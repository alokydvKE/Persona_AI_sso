import { memo, useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { TextShimmerLoader } from "@/components/ui/loader"
import { Message } from "@/components/ui/message"
import { cn } from "@/lib/utils"
import { CHAT_COLUMN } from "./chatLayout"

/** How long each status line stays up before the next one replaces it. */
export const THINKING_PHRASE_INTERVAL_MS = 2500

const DEFAULT_PHRASES: readonly string[] = ["Thinking…"]

type LoadingMessageProps = {
  /**
   * Status lines shown in turn while waiting: the first appears at once, each
   * later one after THINKING_PHRASE_INTERVAL_MS, and the last one stays up for
   * however long the wait lasts. A new list (different text) starts over.
   */
  phrases?: readonly string[]
  /** What screen readers hear, once. The rotating lines are visual only. */
  label?: string
}

/**
 * Index of the phrase to show. Steps forward on a timer and stops at the last
 * one; restarts from 0 when the phrase list changes. The reset is derived during
 * render (keyed by `resetKey`) rather than set from an effect.
 */
export function usePhraseIndex(count: number, resetKey: string): number {
  const [state, setState] = useState({ key: resetKey, index: 0 })
  const index = state.key === resetKey ? state.index : 0

  useEffect(() => {
    if (count <= 1) return
    const timer = setInterval(() => {
      setState((prev) => {
        const current = prev.key === resetKey ? prev.index : 0
        // Holding on the last line: keep the same state so nothing re-renders.
        if (current >= count - 1 && prev.key === resetKey) return prev
        return { key: resetKey, index: Math.min(current + 1, count - 1) }
      })
    }, THINKING_PHRASE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [count, resetKey])

  return Math.min(index, Math.max(count - 1, 0))
}

/**
 * Shown while waiting for a reply: a pulsing sparkle and a shimmering status
 * line that moves through `phrases`, in place of plain typing dots.
 */
const LoadingMessage = memo(
  ({ phrases = DEFAULT_PHRASES, label = "Waiting for a reply" }: LoadingMessageProps) => {
    const lines = phrases.length > 0 ? phrases : DEFAULT_PHRASES
    const index = usePhraseIndex(lines.length, lines.join("\u0000"))

    return (
      <Message
        className={cn(
          CHAT_COLUMN,
          "flex flex-col items-start gap-2 px-0 duration-300 animate-in fade-in slide-in-from-left-2 md:px-10",
        )}
      >
        <div role="status" className="flex min-h-8 items-center gap-2 px-2 md:px-0">
          <Sparkles className="size-4 shrink-0 animate-pulse text-primary" aria-hidden="true" />
          <span className="sr-only">{label}</span>
          {/* Keyed by line, so each new one fades in rather than swapping in place. */}
          <span
            key={index}
            aria-hidden="true"
            data-testid="thinking-phrase"
            className="duration-300 animate-in fade-in slide-in-from-bottom-1"
          >
            <TextShimmerLoader text={lines[index]} size="md" />
          </span>
        </div>
      </Message>
    )
  },
)

LoadingMessage.displayName = "LoadingMessage"

export default LoadingMessage
