import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";
import { useHistoryPager } from "@/hooks/useHistoryPager";

/**
 * History is stored one turn per row: a single `user_message` plus the list of
 * persona `responses` that turn produced (one entry for a single-target reply,
 * many for a broadcast). The view renders a flat list of bubbles, so each turn
 * is flattened into one user bubble followed by one bubble per response.
 */
type RawPersonaReply = {
  persona_id: string;
  persona_name: string;
  response: string;
  evidence_tags?: string[];
  confidence_level?: string | null;
  confidence_score?: number | null;
  /** 1 when the personas didn't answer and this is the shared fallback text. */
  is_fallback?: number | boolean;
};

type RawGroupTurn = {
  user_message: string | null;
  responses: RawPersonaReply[];
  /** Images attached to the user's turn, with short-lived presigned view URLs. */
  images?: { file_id: string; file_name: string; url: string }[];
};

type GroupHistoryResponse = {
  messages: RawGroupTurn[];
  pagination?: Pagination;
};

/** Turns fetched per history window (matches the backend default). */
const HISTORY_PAGE_SIZE = 20;

/**
 * POST /v1/persona/group-chat/history — windowed transcript rehydration.
 *
 * Loads the newest window first and prepends older windows as the user scrolls
 * up (see {@link useHistoryPager}).
 */
export const useGroupHistory = (groupId: string | undefined) => {
  const token = getAuthToken();

  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const data = await postApi<GroupHistoryResponse>(
        "persona/group-chat/history",
        {
          token,
          group_id: groupId,
          limit,
          offset,
        },
      );
      const items = data.messages ?? [];
      return { items, total: data.pagination?.total ?? items.length };
    },
    [token, groupId],
  );

  const pager = useHistoryPager<RawGroupTurn>(
    token && groupId ? groupId : undefined,
    fetchPage,
    HISTORY_PAGE_SIZE,
  );

  // Flatten each turn: the user bubble, then one bubble per persona reply.
  const messages = useMemo<GroupMessageT[]>(() => {
    const out: GroupMessageT[] = [];
    for (const { index, data } of pager.turns) {
      if (data.user_message != null) {
        out.push({
          id: `${groupId}-h-${index}-u`,
          role: "user",
          message: data.user_message,
          images: (data.images ?? []).map((img) => ({
            url: img.url,
            name: img.file_name,
          })),
        });
      }
      const replies = data.responses ?? [];
      // A turn the personas didn't answer saves the same fallback once per
      // persona; it is shown once, as a reply to the whole group.
      if (replies.length > 0 && replies.every((r) => r.is_fallback)) {
        out.push({
          id: `${groupId}-h-${index}-f`,
          role: "system",
          message: replies[0].response,
        });
        continue;
      }
      replies.forEach((r, j) => {
        out.push({
          id: `${groupId}-h-${index}-p${j}`,
          role: "persona",
          message: r.response,
          persona_id: r.persona_id,
          persona_name: r.persona_name,
          evidence_tags: r.evidence_tags,
          confidence_level: r.confidence_level,
          confidence_score: r.confidence_score,
        });
      });
    }
    return out;
  }, [pager.turns, groupId]);

  return {
    messages,
    isInitialLoading: pager.isInitialLoading,
    isError: pager.isError,
    ready: pager.ready,
    hasOlder: pager.hasOlder,
    isLoadingOlder: pager.isLoadingOlder,
    loadOlder: pager.loadOlder,
  };
};

type GroupParticipantsResponse = {
  participants: GroupParticipant[];
};

/** POST /v1/persona/group-chat/participants — speaker labels + colours. */
export const useGroupChatParticipants = (groupId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<GroupParticipant[]>({
    queryKey: ["GroupChatParticipants", groupId],
    queryFn: async () => {
      const data = await postApi<GroupParticipantsResponse>(
        "persona/group-chat/participants",
        { token, group_id: groupId },
      );
      return data.participants ?? [];
    },
    enabled: Boolean(token && groupId),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
};

/* ------------------------------------------------------------------ */
/* Assumptions                                                        */
/* ------------------------------------------------------------------ */

type GroupAssumptionsResponse = {
  assumptions: GroupAssumption[];
  count: number;
  max_allowed: number;
};

/** Cache key shared by the header badge and the dialog, so applying an
 *  assumption in the dialog updates the count without a second request. */
export const groupAssumptionsKey = (groupId: string | undefined) => [
  "GroupAssumptions",
  groupId,
];

/**
 * POST /v1/persona/group-chat/assumptions/list — the statements currently
 * shaping every persona reply in this group.
 *
 * Unlike the old bulk-set endpoint this is a real read path, so the list
 * survives a reload instead of living only in component state.
 *
 * Applied assumptions only. Suggestions are never stored server-side — see
 * ``useHeldSuggestions`` for where those live.
 */
export const useGroupAssumptions = (groupId: string | undefined) => {
  const token = getAuthToken();
  return useQuery<GroupAssumptionsResponse>({
    queryKey: groupAssumptionsKey(groupId),
    queryFn: () =>
      postApi<GroupAssumptionsResponse>("persona/group-chat/assumptions/list", {
        token,
        group_id: groupId,
      }),
    enabled: Boolean(token && groupId),
    refetchOnWindowFocus: false,
  });
};

export const groupSuggestionsKey = (groupId: string | undefined) => [
  "GroupAssumptionSuggestions",
  groupId,
];

/**
 * The suggestions currently on offer for a group.
 *
 * Cache-only — there is nothing to fetch. The server stores no suggestions, so
 * this query never runs a request; `useSuggestAssumptions` writes each round's
 * result under this key and this hook reads it back.
 *
 * The cache is the right home rather than component state because of the
 * lifetime it gives them: they survive closing and reopening the dialog, so an
 * accidental close does not cost an LLM call, and they are keyed by group, so
 * switching chats never shows one group's ideas in another. They are gone on a
 * reload, which is the intended limit — nothing about them is persisted
 * anywhere, and re-asking is one button press.
 */
export const useHeldSuggestions = (groupId: string | undefined) =>
  useQuery<AssumptionSuggestion[]>({
    queryKey: groupSuggestionsKey(groupId),
    // Never runs: the query is permanently disabled and only ever written to.
    queryFn: () => [],
    enabled: false,
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });


