/**
 * The name a new group chat goes by until the server names it from its first
 * exchange (see useChatList): the first persona plus how many others. Every
 * persona's name joined together ran far too long for the top bar and the
 * sidebar; the participants pill already shows who is in the chat.
 */
export function groupChatTitle(names: readonly (string | null | undefined)[]): string {
  const clean = names.map((n) => n?.trim() ?? "").filter(Boolean);
  if (clean.length === 0) return "Group chat";
  if (clean.length === 1) return clean[0];
  return `${clean[0]} + ${clean.length - 1} more`;
}
