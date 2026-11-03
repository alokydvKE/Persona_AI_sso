/**
 * The builder's greeting, handed from "New chat" to the chat screen in router
 * state. The chat shows it (typing it out) at once instead of waiting on its
 * history request, and the history — which contains the same greeting — takes
 * over the same message in place when it arrives.
 */
export type BuilderOpening = { conversationId: string; message: string };

/**
 * The opening carried in `state`, if it belongs to `conversationId`. Router
 * state is untyped and survives reloads and back/forward, so anything that
 * isn't a well-formed opening for this very chat is ignored.
 */
export function readBuilderOpening(
  state: unknown,
  conversationId: string | undefined,
): BuilderOpening | null {
  if (!conversationId || !state || typeof state !== "object") return null;
  const opening = (state as { opening?: unknown }).opening;
  if (!opening || typeof opening !== "object") return null;
  const { conversationId: id, message } = opening as Record<string, unknown>;
  if (id !== conversationId || typeof message !== "string" || !message.trim()) return null;
  return { conversationId: id, message };
}

/**
 * Id the history gives the opening turn's reply (see useBuilderHistory: turn
 * index 0, assistant side). Showing the handed-over greeting under this same id
 * lets React keep one component when the history arrives, so the typewriter
 * carries on instead of restarting.
 */
export const openingMessageId = (conversationId: string) => `${conversationId}-h-0-a`;
