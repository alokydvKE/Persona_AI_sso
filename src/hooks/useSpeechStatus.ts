import { useSyncExternalStore } from "react";
import { speechPlayer, type SpeechStatus } from "@/lib/voice/speechPlayer";

/** Whether this message is being fetched or read aloud. Re-renders only on its own changes. */
export function useSpeechStatus(messageId: string): SpeechStatus {
  return useSyncExternalStore(
    speechPlayer.subscribe,
    () => speechPlayer.statusOf(messageId),
    () => "idle",
  );
}
