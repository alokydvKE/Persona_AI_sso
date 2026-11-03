import { useQuery } from "@tanstack/react-query";
import { getAuthToken, postApi } from "@/lib/api";

type SettingsResponse = { settings: AppSettings };

export const SETTINGS_QUERY_KEY = ["Settings"] as const;

/**
 * POST /v1/setting/get — the user's LLM/AI settings.
 * Creates and returns platform defaults on first call, so it never returns empty.
 */
export const useSettings = () => {
  const token = getAuthToken();
  return useQuery<AppSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const data = await postApi<SettingsResponse>("setting/get", { token });
      return data.settings;
    },
    enabled: !!token,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
};
