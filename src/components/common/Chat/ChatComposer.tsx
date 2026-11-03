import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { CircularLoader } from "@/components/ui/loader";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN, CHAT_INSET } from "./chatLayout";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Disables the whole composer (e.g. chat ended). */
  disabled?: boolean;
  /**
   * Placeholder shown while `disabled`. Defaults to the ended-chat copy, which
   * is the usual reason — pass this when the composer is blocked for some other
   * reason, so the box explains the right one.
   */
  disabledPlaceholder?: string;
  /** Shows a spinner on the send button while a reply is in flight. */
  isSending?: boolean;
  placeholder?: string;
  /** Optional control rendered on the left of the action row (e.g. a target selector). */
  leftSlot?: React.ReactNode;
  /** Optional tools rendered just before the send button (e.g. attach, mic). */
  rightSlot?: React.ReactNode;
  /** Optional content rendered above the textarea (e.g. an attachment preview strip). */
  attachmentBar?: React.ReactNode;
  /**
   * Locks typing and sending while leaving the action row usable (e.g. while
   * the mic is recording, so its stop button still works).
   */
  inputLocked?: boolean;
  /**
   * Optional live status shown in place of the textarea (e.g. voice
   * recording). The textarea stays mounted underneath, so its text and height
   * are kept.
   */
  statusBar?: React.ReactNode;
  /** Ref to the composer's root element (used to focus the textarea, e.g. when editing a message). */
  rootRef?: React.Ref<HTMLDivElement>;
};

/**
 * Shared chat input bar used by both the persona-builder and group chats.
 * Submits on Enter (Shift+Enter for newline) via the underlying PromptInput.
 */
function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  disabledPlaceholder = "This chat has ended",
  isSending = false,
  placeholder = "Ask anything",
  leftSlot,
  rightSlot,
  attachmentBar,
  inputLocked = false,
  statusBar,
  rootRef,
}: ChatComposerProps) {
  const canSend =
    Boolean(value.trim()) && !disabled && !isSending && !inputLocked;

  const handleSubmit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return (
    <div
      ref={rootRef}
      className={cn(CHAT_COLUMN, CHAT_INSET, "inset-x-0 bottom-0 shrink-0 pb-3")}
    >
      <PromptInput
        isLoading={isSending}
        value={value}
        onValueChange={onChange}
        onSubmit={handleSubmit}
        disabled={disabled}
        className="border-input bg-popover/85 backdrop-blur-xl relative z-10 w-full rounded-2xl border p-0 pt-1 shadow-[0_8px_30px_-10px_rgba(16,24,40,0.18)]"
      >
        <div className="flex flex-col">
          {attachmentBar && (
            <div className="px-3 pt-2" onClick={(e) => e.stopPropagation()}>
              {attachmentBar}
            </div>
          )}
          <div className="relative">
            <PromptInputTextarea
              placeholder={disabled ? disabledPlaceholder : placeholder}
              disabled={disabled || inputLocked}
              className={cn(
                "min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base",
                statusBar && "invisible",
              )}
            />
            {statusBar && (
              <div
                className="absolute inset-x-0 top-0 h-full"
                onClick={(e) => e.stopPropagation()}
              >
                {statusBar}
              </div>
            )}
          </div>

          <PromptInputActions className="mt-2 flex w-full items-center justify-between gap-2 px-3 pb-3 pt-1">
            {/* Stop the click from reaching PromptInput's focus-the-textarea
                handler, which would otherwise steal focus and close any control
                (e.g. the recipient selector) rendered here. Pointer events are
                left alone so Radix's own open-on-pointerdown still works. */}
            <div
              className="flex min-w-0 items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {leftSlot}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {rightSlot && (
                <div
                  className="flex items-center gap-0.5 sm:gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {rightSlot}
                </div>
              )}
              <Button
                size="icon"
                disabled={!canSend}
                onClick={handleSubmit}
                aria-label="Send message"
                className={cn(
                  "ml-1 size-10 rounded-xl",
                  canSend && "shadow-md shadow-primary/30",
                )}
              >
                {isSending ? (
                  <CircularLoader size="sm" className="border-white" />
                ) : (
                  <ArrowUp size={18} />
                )}
              </Button>
            </div>
          </PromptInputActions>
        </div>
      </PromptInput>
    </div>
  );
}

export default ChatComposer;
