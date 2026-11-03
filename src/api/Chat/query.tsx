import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";
import { getSession } from "@/lib/chatStore";
import { useHistoryPager } from "@/hooks/useHistoryPager";
import type { PersonaBuildStep } from "@/api/Persona/query";

/**
 * History is stored one turn per row: a single `user_message` (null for the
 * opening turn) paired with the assistant `response`. The view renders one
 * bubble per speaker, so each turn is flattened into up to two MessageT entries.
 */
type RawBuilderTurn = {
  user_message: string | null;
  response: string | null;
};

/**
 * Snapshot of the persona-build background job tied to this conversation,
 * returned by /chat/history on the newest page. Lets the transcript render the
 * build's progress/outcome permanently (and resume polling if still running),
 * instead of the loader vanishing once the live session ends. Absent for chats
 * that never kicked off a build.
 */
export type BuilderBuildSnapshot = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  steps: PersonaBuildStep[] | null;
};

type BuilderHistoryResponse = {
  messages: RawBuilderTurn[];
  pagination?: Pagination;
  build?: BuilderBuildSnapshot | null;
  data_source?: DataSourceKey;
  data_source_selected?: boolean;
  data_source_locked?: boolean;
};

/** Turns fetched per history window (matches the backend default). */
const HISTORY_PAGE_SIZE = 20;

/**
 * POST /v1/persona/chat/history — windowed rehydration of a builder chat.
 *
 * Loads the newest window first and prepends older windows as the user scrolls
 * up (see {@link useHistoryPager}). The opening assistant message (saved by the
 * flow="start" turn) is part of the persisted history, so a freshly started
 * conversation already returns one turn here.
 */
export const useBuilderHistory = (conversationId: string | undefined) => {
  const token = getAuthToken();

  // Build snapshot lives on the newest page (offset 0) only. Captured here as the
  // pager fetches that page, and reset when the conversation changes so a stale
  // build from the previous chat never leaks in before the new fetch resolves.
  const [build, setBuild] = useState<BuilderBuildSnapshot | null>(null);
  useEffect(() => setBuild(null), [conversationId]);

  // Which dataset this chat builds from, and whether it can still be changed.
  // Conversation state rather than message state, so it rides the same newest-page
  // fetch: reopening the chat anywhere shows the dataset the user confirmed, and
  // the picker knows to render read-only once the build has been dispatched.
  //
  // Stamped with the conversation it came from and discarded by comparison rather
  // than cleared in an effect, so switching chats can never render the previous
  // chat's dataset for a frame before the reset lands.
  const [source, setSource] = useState<{
    conversationId: string | undefined;
    key: DataSourceKey | null;
    selected: boolean;
    locked: boolean;
  }>({ conversationId, key: null, selected: false, locked: false });
  const forThisChat = source.conversationId === conversationId;
  const dataSource = forThisChat ? source.key : null;
  // Whether a dataset was actually CHOSEN — distinct from which one is in
  // effect. A chat nobody has chosen for still reports "master" (what it would
  // build from) but gates the composer until the user commits to it.
  const dataSourceSelected = forThisChat && source.selected;
  const dataSourceLocked = forThisChat ? source.locked : false;

  /** Mirror a change the user just saved, without refetching the history page. */
  const setDataSource = useCallback(
    (key: DataSourceKey) =>
      setSource((prev) => ({ ...prev, conversationId, key, selected: true })),
    [conversationId],
  );

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const data = await postApi<BuilderHistoryResponse>("persona/chat/history", {
        token,
        conversation_id: conversationId,
        limit,
        offset,
      });
      if (offset === 0) {
        setBuild(data.build ?? null);
        setSource({
          conversationId,
          key: data.data_source ?? DEFAULT_DATA_SOURCE,
          selected: Boolean(data.data_source_selected),
          locked: Boolean(data.data_source_locked),
        });
      }
      const items = data.messages ?? [];
      return { items, total: data.pagination?.total ?? items.length };
    },
    [token, conversationId],
  );

  const pager = useHistoryPager<RawBuilderTurn>(
    token && conversationId ? conversationId : undefined,
    fetchPage,
    HISTORY_PAGE_SIZE,
  );

  // Flatten each turn into its user bubble (if any) then the assistant reply.
  const messages = useMemo<MessageT[]>(() => {
    const out: MessageT[] = [];
    for (const { index, data } of pager.turns) {
      if (data.user_message != null) {
        out.push({
          id: `${conversationId}-h-${index}-u`,
          message: data.user_message,
          userType: "User",
        });
      }
      if (data.response != null) {
        out.push({
          id: `${conversationId}-h-${index}-a`,
          message: data.response,
          userType: "Assistant",
        });
      }
    }
    return out;
  }, [pager.turns, conversationId]);

  return {
    messages,
    build,
    dataSource,
    dataSourceSelected,
    dataSourceLocked,
    setDataSource,
    isInitialLoading: pager.isInitialLoading,
    isError: pager.isError,
    ready: pager.ready,
    hasOlder: pager.hasOlder,
    isLoadingOlder: pager.isLoadingOlder,
    loadOlder: pager.loadOlder,
  };
};

/* ------------------------------------------------------------------ */
/* Data source (which dataset a persona build reads)                  */
/* ------------------------------------------------------------------ */

/**
 * The dataset a persona build queries. Mirrors the backend's three keys
 * (app/services/persona_data_sources.py), which are in turn the contract with
 * the persona worker — so these strings are stable and never localised.
 */
export type DataSourceKey = "master" | "uploaded" | "combined";

/** What a build reads when nobody chose — the shared master table. */
export const DEFAULT_DATA_SOURCE: DataSourceKey = "master";

/**
 * One row of the picker. `available` is false when the project cannot build from
 * it yet (no processed data), in which case `reason_message` explains why — the
 * row is still shown, greyed out, so the user can see the option exists.
 */
export type DataSourceOption = {
  key: DataSourceKey;
  label: string;
  description: string;
  available: boolean;
  reason?: string;
  reason_message?: string;
};

type DataSourceOptionsResponse = {
  project_id: string;
  default: DataSourceKey;
  options: DataSourceOption[];
};

/**
 * POST /v1/persona/chat/data-sources — the datasets this project can build from.
 *
 * Availability depends on whether the project's uploaded data has finished
 * processing, which can change between visits, so this is deliberately not
 * cached for long: the confirmation dialog re-reads it before the user commits.
 */
export const useDataSourceOptions = (projectId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<DataSourceOptionsResponse>({
    queryKey: ["DataSourceOptions", projectId],
    queryFn: () =>
      postApi<DataSourceOptionsResponse>("persona/chat/data-sources", {
        token,
        project_id: projectId,
      }),
    enabled: Boolean(token && projectId),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
};

/* ------------------------------------------------------------------ */
/* Chat list (sidebar Recents)                                        */
/* ------------------------------------------------------------------ */

/** A chat as the sidebar Recents list renders it, normalised across kinds. */
export type RecentChat = {
  /** conversation_id (builder) or group_id (group). */
  id: string;
  kind: "builder" | "group";
  /** Route to open the chat. */
  to: string;
  projectId: string;
  title: string;
  /**
   * Whether `title` came from the server rather than a local fallback. The
   * server title is written by a background job after the first turn, so this is
   * what "has the real name landed yet?" means — `title` itself is never empty.
   */
  hasServerTitle: boolean;
  status: string;
  /** created_at as epoch ms (0 when unknown). */
  createdAt: number;
  /**
   * Last-activity time as epoch ms — the newest message in the chat, or its
   * creation time when it has no messages yet. Recents are ordered by this so
   * the chat a user most recently interacted with floats to the top.
   */
  updatedAt: number;
};

type ChatListResponse = {
  builder_chats: Array<{
    conversation_id: string;
    project_id: string;
    status: string;
    title: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  group_chats: Array<{
    group_id: string;
    project_id: string;
    persona_ids: string[];
    status: string;
    title: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
};

const toEpoch = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/**
 * How the list waits for a chat's auto-generated name.
 *
 * The backend names a chat from its first exchange in a fire-and-forget task, so
 * the name lands seconds AFTER the send response that triggered it — there is
 * nothing in that response to wait on. Polling briefly is what turns "refresh
 * the page to see the real name" into the name appearing on its own.
 *
 * Bounded on purpose: title generation can fail or time out server-side and
 * simply leave the title null forever, so a poll that ran until it succeeded
 * would run forever. After the window the local fallback name stands.
 */
const TITLE_POLL_MS = 2_500;
const MAX_TITLE_POLLS = 10;

/**
 * POST /v1/persona/chat-list — the project's builder and group chats.
 *
 * The backend is the source of truth for which chats exist (so Recents survives
 * a hard refresh or a different device) and now for their titles too: a title is
 * auto-generated server-side after the first turn and can be renamed. We fall
 * back to the locally-cached title (e.g. an optimistic first-message snippet)
 * until the server title lands, then to a sensible default label.
 *
 * Rows are ordered by `updated_at` (last-activity time) so the most recently
 * used chat is first.
 *
 * One-on-one persona chats are intentionally excluded — that flow is disabled on
 * the backend; group chat is the only path to a persona.
 *
 * `awaitTitleFor` is the id of a chat whose first turn was just sent: the list
 * re-fetches on a short interval until that chat's server title appears, so the
 * Recents entry renames itself instead of waiting for the next page load. Every
 * observer of this query shares one cache entry, so the sidebar picks the new
 * name up from the chat view's poll without asking for it.
 */
export const useChatList = (
  projectId: string | undefined,
  { awaitTitleFor }: { awaitTitleFor?: string } = {},
) => {
  const token = getAuthToken();
  // Counted here rather than by wall-clock so the budget is "polls actually
  // made", which a backgrounded tab cannot silently burn through.
  const pollsRef = useRef(0);
  return useQuery<RecentChat[]>({
    queryKey: ["ChatList", projectId],
    queryFn: async () => {
      const data = await postApi<ChatListResponse>("persona/chat-list", {
        token,
        project_id: projectId,
      });

      const items: RecentChat[] = [
        ...(data.builder_chats ?? []).map((c) => {
          const createdAt = toEpoch(c.created_at);
          return {
            id: c.conversation_id,
            kind: "builder" as const,
            to: `/chat/${c.conversation_id}`,
            projectId: c.project_id,
            title:
              c.title || getSession(c.conversation_id)?.title || "Persona chat",
            hasServerTitle: Boolean(c.title),
            status: c.status,
            createdAt,
            updatedAt: toEpoch(c.updated_at) || createdAt,
          };
        }),
        ...(data.group_chats ?? []).map((g) => {
          const createdAt = toEpoch(g.created_at);
          return {
            id: g.group_id,
            kind: "group" as const,
            to: `/group-chat/${g.group_id}`,
            projectId: g.project_id,
            title:
              g.title ||
              getSession(g.group_id)?.title ||
              `Group chat · ${g.persona_ids?.length ?? 0} personas`,
            hasServerTitle: Boolean(g.title),
            status: g.status,
            createdAt,
            updatedAt: toEpoch(g.updated_at) || createdAt,
          };
        }),
      ];

      // Most-recent activity first; fall back to creation time on ties.
      items.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
      return items;
    },
    enabled: Boolean(token && projectId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (!awaitTitleFor) {
        pollsRef.current = 0;
        return false;
      }
      const row = query.state.data?.find((c) => c.id === awaitTitleFor);
      // Landed — stop immediately rather than finishing the budget.
      if (row?.hasServerTitle) {
        pollsRef.current = 0;
        return false;
      }
      if (pollsRef.current >= MAX_TITLE_POLLS) return false;
      pollsRef.current += 1;
      return TITLE_POLL_MS;
    },
  });
};
