import { useEffect, useMemo, useState } from "react";

/**
 * Progressively reveals `text` word-by-word for a typewriter effect.
 *
 * Reveals whole words (with their trailing whitespace) so markdown tokens like
 * **bold** render cleanly rather than flashing partial syntax. setState only
 * happens inside the interval callback (never synchronously in the effect body),
 * so it doesn't trip the cascading-render lint rule. When `enabled` is false the
 * full text is returned immediately (e.g. for rehydrated history).
 */
export function useTypewriter(
  text: string,
  enabled: boolean,
  speedMs = 24,
): string {
  const tokens = useMemo(() => text.match(/\S+\s*/g) ?? [], [text]);
  const [count, setCount] = useState(enabled ? 0 : tokens.length);

  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= tokens.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [tokens, enabled, speedMs]);

  if (!enabled || count >= tokens.length) return text;
  return tokens.slice(0, count).join("");
}
