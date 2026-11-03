import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN } from "./chatLayout";
import { useTypewriter } from "@/hooks/useTypewriter";
import { Check, Copy, Pencil } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import BuilderAvatar from "./BuilderAvatar";

type MessageComponentProps = {
  message: MessageT;
  isLastMessage: boolean;
  /**
   * When provided (user messages only), shows an Edit action that loads the
   * message text back into the composer so it can be edited and re-sent.
   */
  onEdit?: (text: string) => void;
  /** Typewriter-reveal this message (a freshly received assistant reply). */
  animate?: boolean;
  /** Delay before this message's entrance, to stagger a batch (e.g. history). */
  enterDelayMs?: number;
};

export const MessageComponent = memo(
  ({ message, isLastMessage, onEdit, animate, enterDelayMs = 0 }: MessageComponentProps) => {
    const [copied, setCopied] = useState(false);
    const isAssistant = message.userType === "Assistant";
    const shown = useTypewriter(message.message, Boolean(animate) && isAssistant);
    // The typewriter reveals from the first non-space character on.
    const writing =
      Boolean(animate) && isAssistant && shown.length < message.message.trimStart().length;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        toast.error("Couldn't copy to clipboard");
      }
    };

    return (
      <Message
        style={
          enterDelayMs > 0
            ? { animationDelay: `${enterDelayMs}ms`, animationFillMode: "backwards" }
            : undefined
        }
        className={cn(
          CHAT_COLUMN,
          "flex flex-col gap-2 px-2 md:px-10",
          "duration-300 animate-in fade-in motion-reduce:animate-none",
          isAssistant
            ? "items-start slide-in-from-left-2"
            : "items-end slide-in-from-right-2",
        )}
      >
        {isAssistant ? (
          <div className="group flex w-full items-start gap-3">
            <BuilderAvatar active={writing} />
            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <MessageContent
                className="text-foreground prose w-full min-w-0 flex-1 rounded-lg bg-transparent p-0"
                markdown
              >
                {shown}
              </MessageContent>
              <MessageActions
                className={cn(
                  "-ml-2.5 flex",
                  isLastMessage && "opacity-100",
                )}
              >
                <MessageAction tooltip={copied ? "Copied" : "Copy"} delayDuration={100}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="text-emerald-600" /> : <Copy />}
                  </Button>
                </MessageAction>
              </MessageActions>
            </div>
          </div>
        ) : (
          <div className="group flex w-full flex-col items-end gap-1">
            <MessageContent className="bg-muted text-primary max-w-[85%] rounded-3xl px-5 py-2.5 whitespace-pre-wrap sm:max-w-[75%]">
              {message.message}
            </MessageContent>
            <MessageActions className="flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {onEdit && (
                <MessageAction tooltip="Edit" delayDuration={100}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => onEdit(message.message)}
                  >
                    <Pencil />
                  </Button>
                </MessageAction>
              )}
              <MessageAction tooltip={copied ? "Copied" : "Copy"} delayDuration={100}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="text-emerald-600" /> : <Copy />}
                </Button>
              </MessageAction>
            </MessageActions>
          </div>
        )}
      </Message>
    );
  },
);

MessageComponent.displayName = "MessageComponent";
