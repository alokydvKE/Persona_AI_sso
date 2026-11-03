/**
 * Voice API paths. Deliberately neutral so they don't advertise a voice API
 * (the backend also hides them from its OpenAPI docs):
 *   state  = voice config    ingest = speech to text    render = text to speech
 */
export const VOICE_ENDPOINTS = {
  config: "sync/state",
  stt: "sync/ingest",
  tts: "sync/render",
} as const;
