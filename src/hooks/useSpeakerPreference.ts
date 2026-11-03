import { useCallback, useState } from "react";

export const SPEAKER_PREFERENCE_KEY = "persona-ai:read-replies-aloud";

function read(): boolean {
  try {
    return localStorage.getItem(SPEAKER_PREFERENCE_KEY) === "on";
  } catch {
    return false;
  }
}

/** "Read replies aloud" on/off, remembered on this device. Off by default. */
export function useSpeakerPreference(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabledState] = useState(read);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      localStorage.setItem(SPEAKER_PREFERENCE_KEY, next ? "on" : "off");
    } catch {
      // Private mode / blocked storage: the choice still applies this session.
    }
  }, []);

  return [enabled, setEnabled];
}
