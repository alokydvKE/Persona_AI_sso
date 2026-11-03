import { useLocation } from "react-router";
import { getSession } from "@/lib/chatStore";

/** Extracts the conversation/group id from a chat pathname, if present. */
export function chatIdFromPath(pathname: string): string | undefined {
  return pathname.match(/^\/(?:group-chat|chat)\/([^/]+)/)?.[1];
}

/** The persona-builder conversation id in a pathname — never a group chat's. */
export function builderChatIdFromPath(pathname: string): string | undefined {
  return pathname.match(/^\/chat\/([^/]+)/)?.[1];
}

/**
 * Resolves the project a chat route belongs to.
 *
 * Navigation passes `state.projectId`, but that is lost on a hard refresh and is
 * not visible to layout-level components, so we fall back to the locally
 * persisted session keyed by the id parsed from the pathname. Returns undefined
 * when neither source is available.
 */
export function useActiveProjectId(): string | undefined {
  const { state, pathname } = useLocation();

  const stateProjectId = (state as { projectId?: string } | null)?.projectId;
  if (stateProjectId) return stateProjectId;

  return getSession(chatIdFromPath(pathname))?.projectId;
}
