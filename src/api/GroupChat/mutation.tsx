import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getAuthToken, postApi } from "@/lib/api";
import { apiRequest } from "@/services/apiService";
import { upsertSession } from "@/lib/chatStore";
import { queryClient } from "@/provider";
import { groupAssumptionsKey, groupSuggestionsKey } from "./query";

/* ------------------------------------------------------------------ */
/* Start a group chat                                                 */
/* ------------------------------------------------------------------ */

type StartGroupChatArgs = {
  projectId: string;
  personaIds: string[];
  /** Human-readable label for the Recents list. */
  title: string;
};

type StartGroupChatResponse = {
  group_id: string;
  message: string;
};

/**
 * Start a group chat.
 *
 * The old /group-chat/start endpoint was folded into /group-chat/message —
 * switched by `flow: "start"`, which still returns { group_id, message }.
 *
 * Works for both a single persona and many — group chat is the only chat path
 * to a persona. On success it persists a Recents session and navigates to the
 * group chat route.
 */
export const useStartGroupChat = () => {
  const navigate = useNavigate();
  const token = getAuthToken();

  return useMutation<StartGroupChatResponse, Error, StartGroupChatArgs>({
    mutationKey: ["StartGroupChat"],
    mutationFn: ({ projectId, personaIds }) =>
      postApi<StartGroupChatResponse>("persona/group-chat/message", {
        token,
        flow: "start",
        project_id: projectId,
        persona_ids: personaIds,
      }),
    onSuccess: (data, vars) => {
      upsertSession({
        id: data.group_id,
        kind: "group",
        projectId: vars.projectId,
        title: vars.title,
        personaIds: vars.personaIds,
      });
      // Surface the new group in the sidebar Recents (sourced from chat-list).
      queryClient.invalidateQueries({ queryKey: ["ChatList", vars.projectId] });
      navigate(`/group-chat/${data.group_id}`, {
        state: { projectId: vars.projectId },
      });
    },
  });
};

/* ------------------------------------------------------------------ */
/* Image attachments (server-side / proxy upload)                     */
/* ------------------------------------------------------------------ */

type UploadedImage = {
  file_id: string;
  file_name: string;
  s3_key: string;
};

type ImageUploadResponse = {
  images: UploadedImage[];
  errors: { file_name: string; reason: string }[];
};

/**
 * Upload group-chat images through the backend (proxy upload) and return the
 * `file_id`s to attach to the message.
 *
 * The browser posts the raw bytes as multipart/form-data to
 * /group-chat/image/upload; the server stores them in S3 itself, so no
 * browser→S3 request (and therefore no bucket CORS) is required. Throws a
 * user-facing error if the server rejects any file, so the caller can surface
 * one error and roll back the optimistic message.
 */
export async function uploadGroupImages(
  groupId: string,
  files: File[],
): Promise<string[]> {
  if (files.length === 0) return [];

  const token = getAuthToken();
  const form = new FormData();
  form.append("token", token);
  form.append("group_id", groupId);
  files.forEach((f) => form.append("files", f, f.name));

  const data = await postApi<ImageUploadResponse>(
    "persona/group-chat/image/upload",
    form as unknown as Record<string, unknown>,
  );

  const uploaded = data.images ?? [];
  const rejected = data.errors ?? [];

  if (rejected.length > 0) {
    throw new Error(rejected[0]?.reason || "Some images could not be uploaded");
  }
  if (uploaded.length !== files.length) {
    throw new Error("Could not upload all images, please retry");
  }

  return uploaded.map((u) => u.file_id);
}

/* ------------------------------------------------------------------ */
/* Shared assumptions / context                                       */
/* ------------------------------------------------------------------ */

/**
 * POST /v1/persona/group-chat/context — replaces the assumptions list wholesale.
 *
 * @deprecated Superseded by the assumption hooks below, which validate each
 * statement, address entries by id, and read the list back from the server.
 * This one applies whatever it is given with no validation. Kept only for
 * callers not yet migrated.
 */
export const useGroupContext = (groupId: string) => {
  const token = getAuthToken();
  return useMutation<Record<string, never>, Error, { assumptions: string[] }>({
    mutationKey: ["GroupContext", groupId],
    mutationFn: ({ assumptions }) =>
      postApi<Record<string, never>>("persona/group-chat/context", {
        token,
        group_id: groupId,
        assumptions,
      }),
  });
};

/* ------------------------------------------------------------------ */
/* Assumptions                                                        */
/* ------------------------------------------------------------------ */

/**
 * POST /v1/persona/group-chat/assumptions/suggest — ask the model to propose
 * assumptions that fit this group's personas.
 *
 * Nothing is stored: each proposal carries a `token` proving the API authored
 * it, and the caller holds the list in component state. Calls are independent —
 * the server keeps no record of earlier ones, so pressing again may return an
 * idea already seen.
 */
export const useSuggestAssumptions = (groupId: string) => {
  const token = getAuthToken();
  // From context, not the module singleton: the cache written here is read back
  // by `useHeldSuggestions`, so both must be the same client.
  const cache = useQueryClient();
  return useMutation<AssumptionSuggestion[], Error, { count?: number } | void>({
    mutationKey: ["SuggestAssumptions", groupId],
    mutationFn: async (vars) => {
      const data = await postApi<{ suggestions: AssumptionSuggestion[] }>(
        "persona/group-chat/assumptions/suggest",
        { token, group_id: groupId, count: vars?.count },
      );
      return data.suggestions ?? [];
    },
    // Each round REPLACES the last: these are this press's ideas, and nothing is
    // carried forward. Written to the cache rather than returned to component
    // state so they outlive the dialog being closed and reopened.
    onSuccess: (fresh) => {
      cache.setQueryData(groupSuggestionsKey(groupId), fresh);
    },
  });
};

type AddAssumptionArgs = {
  /** The statement to apply. */
  text: string;
  /**
   * The signature that came with this text when the API authored it — from
   * /suggest, or as `suggested_token` on a rejection. Omit for text the user
   * typed; it is then validated like any other input.
   */
  suggestionToken?: string | null;
};

/**
 * POST /v1/persona/group-chat/assumptions/add.
 *
 * Resolves for BOTH verdicts: an applied assumption and a rejected one are both
 * successful calls (the backend answers 200 either way, because the rejection
 * reason and its replacement are the useful part). Callers must branch on
 * `result.status` rather than assuming success means applied.
 */
export const useAddAssumption = (groupId: string) => {
  const token = getAuthToken();
  return useMutation<AssumptionVerdict, Error, AddAssumptionArgs>({
    mutationKey: ["AddAssumption", groupId],
    mutationFn: ({ text, suggestionToken }) =>
      postApi<AssumptionVerdict>("persona/group-chat/assumptions/add", {
        token,
        group_id: groupId,
        text,
        suggestion_token: suggestionToken ?? undefined,
      }),
    onSuccess: (result) => {
      // Only an applied assumption changes the stored list.
      if (result.status === "approved") {
        queryClient.invalidateQueries({
          queryKey: groupAssumptionsKey(groupId),
        });
      }
    },
  });
};

/** POST /v1/persona/group-chat/assumptions/remove — stops it shaping replies. */
export const useRemoveAssumption = (groupId: string) => {
  const token = getAuthToken();
  return useMutation<
    { assumption_id: string },
    Error,
    { assumptionId: string }
  >({
    mutationKey: ["RemoveAssumption", groupId],
    mutationFn: ({ assumptionId }) =>
      postApi<{ assumption_id: string }>(
        "persona/group-chat/assumptions/remove",
        {
          token,
          group_id: groupId,
          assumption_id: assumptionId,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupAssumptionsKey(groupId) });
    },
  });
};

/* ------------------------------------------------------------------ */
/* Insights report                                                    */
/* ------------------------------------------------------------------ */

/** Filename from `Content-Disposition` (RFC 5987 `filename*` first). */
function fileNameFromDisposition(header: unknown): string | null {
  const value = typeof header === "string" ? header : "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value);
  return plain ? plain[1].trim() : null;
}

/**
 * POST /v1/persona/group-chat/insights/download — builds an audience-insights
 * report (Word .docx) from the whole transcript and saves it in the browser.
 *
 * The report is generated per request (one LLM call), so this can take a
 * while; failures (including the per-chat download limit) come back as the
 * usual JSON envelope and are toasted by `apiRequest`.
 */
export const useDownloadGroupInsights = (groupId: string) =>
  useMutation<void, Error, void>({
    mutationKey: ["DownloadGroupInsights", groupId],
    mutationFn: async () => {
      const res = await apiRequest(
        "post",
        "persona/group-chat/insights/download",
        { token: getAuthToken(), group_id: groupId },
        "blob",
      );
      const file = res?.response;
      if (!(file instanceof Blob) || file.size === 0) {
        throw new Error("Couldn't download the insights report.");
      }
      const fileName =
        fileNameFromDisposition(res?.headers?.["content-disposition"]) ??
        `insights_${groupId}.docx`;

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });

type GroupSurveyPromptResponse = {
  prompt: string;
};

export const useGroupSurveyPrompt = (groupId: string | undefined) => {
  const token = getAuthToken();

  return useMutation<GroupSurveyPromptResponse, Error, void>({
    mutationKey: ["group-survey-prompt", groupId],
    mutationFn: () => {
      if (!groupId) {
        return Promise.reject(new Error("Group ID is required"));
      }

      return postApi<GroupSurveyPromptResponse>(
        "persona/group-chat/survey-prompt",
        {
          token,
          group_id: groupId,
        },
      );
    },
  });
};

type GroupDownloadInsightsLimitResponse = {
  used: number;
  limit: number;
  remaining: number;
};

export const useGroupDownloadInsightsLimit = (groupId: string | undefined) => {
  const token = getAuthToken();

  return useMutation<GroupDownloadInsightsLimitResponse, Error, void>({
    mutationKey: ["group-download-insights-limit", groupId],
    mutationFn: () => {
      if (!groupId) {
        return Promise.reject(new Error("Group ID is required"));
      }

      return postApi<GroupDownloadInsightsLimitResponse>(
        "persona/group-chat/insights/limit",
        {
          token,
          group_id: groupId,
        },
      );
    },
  });
};

type GroupSurveyPromptLimitResponse = {
  used: number;
  limit: number;
  remaining: number;
  prompt: string;
};

export const useGroupSurveyPromptLimit = (groupId: string | undefined) => {
  const token = getAuthToken();

  return useMutation<GroupSurveyPromptLimitResponse, Error, void>({
    mutationKey: ["group-survey-prompt-limit", groupId],
    mutationFn: () => {
      if (!groupId) {
        return Promise.reject(new Error("Group ID is required"));
      }

      return postApi<GroupSurveyPromptLimitResponse>(
        "persona/group-chat/survey-prompt/limit",
        {
          token,
          group_id: groupId,
        },
      );
    },
  });
};
