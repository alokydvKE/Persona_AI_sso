/**
 * Local persistence for chat sessions.
 *
 * The backend has no endpoint to list a project's past conversations or group
 * chats, so we keep a lightweight index in localStorage. This powers the
 * sidebar "Recents" list and lets us recover a chat's project on a hard refresh
 * (where react-router navigation state is lost). Transcripts themselves are
 * always re-fetched from the history endpoints — we only store metadata here.
 */

export type ChatKind = "builder" | "group";

export type ChatSession = {
  /** conversation_id (builder) or group_id (group chat). */
  id: string;
  kind: ChatKind;
  projectId: string;
  title: string;
  /** Personas in a group chat (group kind only). */
  personaIds?: string[];
  /** True once the conversation/group has been ended. */
  ended?: boolean;
  /**
   * persona_query background job id returned when a builder chat finishes
   * building (builder kind only). Kept so the "Building Your Personas…" progress
   * can resume after a navigation/refresh. Cleared once the job completes.
   */
  queryJobId?: string | null;
  createdAt: number;
  updatedAt: number;
};

const INDEX_PREFIX = "personaai:chats:"; // per-project list of session ids
const SESSION_PREFIX = "personaai:chat:"; // session id -> ChatSession

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readIndex(projectId: string): string[] {
  return safeParse<string[]>(localStorage.getItem(INDEX_PREFIX + projectId), []);
}

function writeIndex(projectId: string, ids: string[]): void {
  localStorage.setItem(INDEX_PREFIX + projectId, JSON.stringify(ids));
}

export function getSession(id: string | undefined | null): ChatSession | undefined {
  if (!id) return undefined;
  return safeParse<ChatSession | undefined>(
    localStorage.getItem(SESSION_PREFIX + id),
    undefined,
  );
}

/** All sessions for a project, most-recently-updated first. */
export function listSessions(projectId: string | undefined | null): ChatSession[] {
  if (!projectId) return [];
  return readIndex(projectId)
    .map((id) => getSession(id))
    .filter((s): s is ChatSession => Boolean(s))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertSession(
  input: Omit<ChatSession, "createdAt" | "updatedAt"> &
    Partial<Pick<ChatSession, "createdAt" | "updatedAt">>,
): ChatSession {
  const now = Date.now();
  const existing = getSession(input.id);
  const session: ChatSession = {
    ...existing,
    ...input,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };
  localStorage.setItem(SESSION_PREFIX + session.id, JSON.stringify(session));

  const ids = readIndex(session.projectId);
  if (!ids.includes(session.id)) {
    writeIndex(session.projectId, [session.id, ...ids]);
  }
  return session;
}

/** Bump a session's updatedAt (and optionally patch title/ended/queryJobId) without other changes. */
export function touchSession(
  id: string,
  patch?: Partial<Pick<ChatSession, "title" | "ended" | "queryJobId">>,
): void {
  const existing = getSession(id);
  if (!existing) return;
  upsertSession({ ...existing, ...patch });
}

/** The most recently used non-ended builder conversation for a project, if any. */
export function findActiveBuilderSession(
  projectId: string | undefined,
): ChatSession | undefined {
  return listSessions(projectId).find((s) => s.kind === "builder" && !s.ended);
}

export function removeSession(id: string): void {
  const session = getSession(id);
  localStorage.removeItem(SESSION_PREFIX + id);
  if (session) {
    writeIndex(
      session.projectId,
      readIndex(session.projectId).filter((sid) => sid !== id),
    );
  }
}
