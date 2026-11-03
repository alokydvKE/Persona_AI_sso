import { useMutation } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";
import { queryClient } from "@/provider";

type GenerateResponse = {
  job_id: string;
  status: string;
  personas: string[];
};

/**
 * POST /v1/persona/generate.
 *
 * Generation runs synchronously on the backend (dummy data today) and is
 * idempotent per project — calling it when personas already exist returns the
 * existing set instead of creating duplicates.
 */
export const usePersonaGenerate = () => {
  const token = getAuthToken();
  return useMutation<GenerateResponse, Error, { projectId: string }>({
    mutationKey: ["PersonaGenerate"],
    mutationFn: ({ projectId }) =>
      postApi<GenerateResponse>("persona/generate", {
        token,
        project_id: projectId,
      }),
  });
};

/**
 * POST /v1/persona/update — rename a persona (name is 2–150 chars; validated
 * server-side too). On success the project's persona list/dashboard and any
 * group-chat participant lists are invalidated so the new name shows everywhere.
 */
export const usePersonaUpdate = (projectId: string | undefined) => {
  const token = getAuthToken();
  return useMutation<
    Record<string, never>,
    Error,
    { personaId: string; personaName: string }
  >({
    mutationKey: ["PersonaUpdate"],
    mutationFn: ({ personaId, personaName }) =>
      postApi<Record<string, never>>("persona/update", {
        token,
        persona_id: personaId,
        persona_name: personaName,
      }),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["PersonaList", projectId] });
        queryClient.invalidateQueries({
          queryKey: ["PersonaDashboard", projectId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["GroupChatParticipants"] });
    },
  });
};
