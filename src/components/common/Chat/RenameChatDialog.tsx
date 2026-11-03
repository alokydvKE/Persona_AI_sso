import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  RenameChat as RenameChatSchema,
  type RenameChatForm,
} from "@/schemas/Chat";
import { useRenameChat } from "@/api/Chat/mutation";
import type { RecentChat } from "@/api/Chat/query";

type Props = {
  /** The chat being renamed, or null when the dialog is closed. */
  chat: RecentChat | null;
  onClose: () => void;
};

/**
 * Rename dialog for a Recents entry, opened from the row's three-dot menu.
 *
 * Kept mounted once in the sidebar and driven by `chat`: it opens (prefilled)
 * whenever a chat is selected and closes on cancel or a successful save. The
 * save is a no-op when the title is unchanged, so we never fire a needless
 * request or toast.
 */
export function RenameChatDialog({ chat, onClose }: Props) {
  const { mutate, isPending } = useRenameChat();

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<RenameChatForm>({
    resolver: zodResolver(RenameChatSchema),
    defaultValues: { title: "" },
  });

  // Prefill with the current title and focus the field whenever a different
  // chat is opened. The timeout lets the dialog content mount before we focus.
  useEffect(() => {
    if (!chat) return;
    reset({ title: chat.title });
    const id = setTimeout(() => setFocus("title"), 0);
    return () => clearTimeout(id);
  }, [chat, reset, setFocus]);

  const onSubmit = (data: RenameChatForm) => {
    if (!chat) return;
    if (data.title === chat.title) {
      onClose();
      return;
    }
    mutate(
      {
        chatId: chat.id,
        chatType: chat.kind,
        title: data.title,
        projectId: chat.projectId,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={chat !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>
              Give this chat a name that's easy to find later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="rename-chat-title" required>
              Chat name
            </Label>
            <Input
              id="rename-chat-title"
              data-test-id="RENAME_CHAT_TITLE"
              maxLength={150}
              autoComplete="off"
              placeholder="e.g. Low-sugar hydration ideas"
              onFocus={(e) => e.currentTarget.select()}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-test-id="RENAME_CHAT_SUBMIT"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
