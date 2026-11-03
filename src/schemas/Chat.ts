import { z } from "zod";

/**
 * Rename a chat (builder conversation or group chat).
 *
 * Mirrors the backend contract (ChatRename in app/schemas/persona.py): a
 * non-empty title of at most 150 characters. `.trim()` normalises the value
 * during validation so surrounding whitespace never satisfies the min length
 * nor counts toward the max — and the trimmed value is what gets submitted.
 */
export const RenameChat = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please enter a chat name")
    .max(150, "Chat name must be 150 characters or fewer"),
});

export type RenameChatForm = z.infer<typeof RenameChat>;
