import { useMutation } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";
import { queryClient } from "@/provider";
import { SETTINGS_QUERY_KEY } from "./query";

type SettingsResponse = { settings: AppSettings };

/** POST /v1/setting/save — partial update; returns the full updated settings. */
export const useSaveSettings = () => {
  const token = getAuthToken();
  return useMutation<AppSettings, Error, Partial<AppSettings>>({
    mutationKey: ["SaveSettings"],
    mutationFn: async (changes) => {
      const data = await postApi<SettingsResponse>("setting/save", {
        token,
        ...changes,
      });
      return data.settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, settings);
    },
  });
};

/** POST /v1/setting/reset — restore platform defaults; returns the defaults. */
export const useResetSettings = () => {
  const token = getAuthToken();
  return useMutation<AppSettings, Error, void>({
    mutationKey: ["ResetSettings"],
    mutationFn: async () => {
      const data = await postApi<SettingsResponse>("setting/reset", { token });
      return data.settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, settings);
    },
  });
};
