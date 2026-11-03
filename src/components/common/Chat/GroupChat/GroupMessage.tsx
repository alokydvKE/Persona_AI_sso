import { memo, useState } from "react";
import { Bot, Check, Copy, Info, Loader2, Pencil, Reply, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ui/message";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN } from "../chatLayout";
import { useSpeechStatus } from "@/hooks/useSpeechStatus";
import { personaColorStyle, personaInitials } from "@/lib/personaColors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Pill colours for a persona reply's confidence level (strong/medium/weak). */
const CONFIDENCE_BADGE: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  weak: "bg-rose-100 text-rose-800 ring-rose-200",
};

/** Pick a badge colour from the free-text confidence label (e.g. "High Confidence"). */
function confidenceBadgeClass(label: string): string {
  const key = label.toLowerCase();
  if (key.includes("high") || key.includes("strong")) return CONFIDENCE_BADGE.strong;
  if (key.includes("medium") || key.includes("moderate")) return CONFIDENCE_BADGE.medium;
  if (key.includes("low") || key.includes("weak")) return CONFIDENCE_BADGE.weak;
  return "bg-secondary text-muted-foreground ring-border";
}

/**
 * The confidence value is "<label>; <explanation>" — the label shows on the
 * badge, the explanation shows on hover. Missing "; " means no explanation.
 */
function parseConfidence(value: string): { label: string; detail: string } {
  const sep = value.indexOf(";");
  if (sep === -1) return { label: value.trim(), detail: "" };
  return { label: value.slice(0, sep).trim(), detail: value.slice(sep + 1).trim() };
}

type GroupMessageProps = {
  message: GroupMessageT;
  /** Backend colour word for the speaking persona (from participants). */
  color?: string;
  /**
   * When provided (user messages only), shows an Edit action that loads the
   * message text back into the composer so it can be edited and re-sent.
   */
  onEdit?: (text: string) => void;
  /**
   * When provided (persona replies only), shows a Reply action that addresses
   * the next message to this persona. The view omits it when that persona
   * can't be messaged. Keep it referentially stable so memoization holds.
   */
  onReply?: (message: GroupMessageT) => void;
  /**
   * When provided (persona replies only), shows a Play/Stop action that reads
   * the reply aloud. Keep it referentially stable so memoization holds.
   */
  onSpeak?: (message: GroupMessageT) => void;
  /** Delay before this message's entrance, to stagger a batch (e.g. history). */
  enterDelayMs?: number;
};

/**
 * A persona's avatar circle — swaps its initials for a mini equalizer (or a
 * spinner while audio is still loading) while their reply is being read
 * aloud, so it's obvious who's talking without hovering anything. Subscribes
 * only to this message's speech status, so it never re-renders the rest of
 * the message (same isolation as SpeakAction below).
 */
function PersonaAvatar({
  messageId,
  initials,
  avatarClass,
}: {
  messageId: string;
  initials: string;
  avatarClass: string;
}) {
  const status = useSpeechStatus(messageId);

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-shadow duration-200",
        avatarClass,
        status === "playing" && "ring-2 ring-current ring-offset-2 ring-offset-background",
      )}
    >
      {status === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Preparing audio" />
      ) : status === "playing" ? (
        <span className="flex h-3 items-end gap-0.5" role="status" aria-label="Speaking">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-full w-0.5 animate-[wave-bars_1s_ease-in-out_infinite] rounded-full bg-current"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      ) : (
        initials
      )}
    </div>
  );
}

/** Play/Stop for one reply; subscribes only to this message's speech status. */
function SpeakAction({
  message,
  onSpeak,
}: {
  message: GroupMessageT;
  onSpeak: (message: GroupMessageT) => void;
}) {
  const status = useSpeechStatus(message.id);
  const label =
    status === "playing" ? "Stop reading" : status === "loading" ? "Stop loading audio" : "Read aloud";

  return (
    <MessageAction tooltip={label} delayDuration={100}>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label={label}
        aria-pressed={status !== "idle"}
        onClick={() => onSpeak(message)}
      >
        {status === "loading" ? (
          <Loader2 className="animate-spin" />
        ) : status === "playing" ? (
          <Square className="fill-current" />
        ) : (
          <Volume2 />
        )}
      </Button>
    </MessageAction>
  );
}

/** Addresses the next message to the persona who wrote this reply. */
function ReplyAction({
  message,
  onReply,
}: {
  message: GroupMessageT;
  onReply: (message: GroupMessageT) => void;
}) {
  const name = message.persona_name?.trim();
  const label = name ? `Reply to ${name}` : "Reply";
  return (
    <MessageAction tooltip={label} delayDuration={100}>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label={label}
        onClick={() => onReply(message)}
      >
        <Reply aria-hidden="true" />
      </Button>
    </MessageAction>
  );
}

/**
 * Renders one group-chat turn: a right-aligned user bubble, a labelled persona
 * reply, or a single fallback reply for the whole group.
 */
const GroupMessage = memo(
  ({ message, color, onEdit, onReply, onSpeak, enterDelayMs = 0 }: GroupMessageProps) => {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);
    const confidence = parseConfidence(message.confidence_level ?? "");
    const enterStyle =
      enterDelayMs > 0
        ? { animationDelay: `${enterDelayMs}ms`, animationFillMode: "backwards" as const }
        : undefined;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.message);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        toast.error("Couldn't copy to clipboard");
      }
    };

    const copyAction = (
      <MessageAction tooltip={copied ? "Copied" : "Copy"} delayDuration={100}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={copied ? "Copied" : "Copy"}
          onClick={handleCopy}
        >
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
        </Button>
      </MessageAction>
    );

    if (isUser) {
      return (
        <Message
          style={enterStyle}
          className={cn(
            CHAT_COLUMN,
            "group flex flex-col items-end gap-1 px-2 duration-300 animate-in fade-in slide-in-from-right-2 md:px-10",
          )}
        >
          {message.images && message.images.length > 0 && (
            <div className="flex max-w-[85%] flex-wrap justify-end gap-2 sm:max-w-[75%]">
              {message.images.map((img, i) => (
                <a
                  key={`${img.url}-${i}`}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-border"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-28 w-28 object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}
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
            {copyAction}
          </MessageActions>
        </Message>
      );
    }

    // One reply for the whole group (the fallback when personas can't answer).
    if (message.role === "system") {
      return (
        <Message
          style={enterStyle}
          className={cn(
            CHAT_COLUMN,
            "group flex flex-row items-start gap-3 px-2 duration-300 animate-in fade-in slide-in-from-left-2 md:px-10",
          )}
        >
          {/* Grey robot, not a coloured persona avatar: the app is speaking. */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Bot className="size-4" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 items-start pt-1">
            <MessageContent
              markdown
              className="text-muted-foreground prose w-full min-w-0 rounded-lg bg-transparent p-0"
            >
              {message.message}
            </MessageContent>
            <MessageActions className="flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
              {copyAction}
            </MessageActions>
          </div>
        </Message>
      );
    }

    const style = personaColorStyle(color);

    return (
      <Message
        style={enterStyle}
        className={cn(
          CHAT_COLUMN,
          "group flex flex-row items-start gap-3 px-2 duration-300 animate-in fade-in slide-in-from-left-2 md:px-10",
        )}
      >
        <PersonaAvatar
          messageId={message.id}
          initials={personaInitials(message.persona_name ?? "?")}
          avatarClass={style.avatar}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 items-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-semibold", style.text)}>
              {message.persona_name}
            </span>
          </div>
          <MessageContent
            markdown
            className="text-foreground prose w-full min-w-0 rounded-lg bg-transparent p-0"
          >
            {message.message}
          </MessageContent>
          {message.evidence_tags && message.evidence_tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {message.evidence_tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
                    style.chip,
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Footer: confidence on the left, actions on the right. Wraps onto
              two lines when the column is too narrow for both. */}
          <div className="mt-1.5 flex w-full flex-wrap items-center gap-x-3 gap-y-1">
            {confidence.label && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                  Confidence level:
                </span>
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                    confidenceBadgeClass(confidence.label),
                  )}
                >
                  {confidence.label.split(" ")[0]}
                  {typeof message.confidence_score === "number"
                    ? ` · ${message.confidence_score}%`
                    : ""}
                  {confidence.detail && (
                    <Tooltip>
                      <TooltipTrigger
                        aria-label="Why this confidence level"
                        className="flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-current"
                      >
                        <Info className="size-3" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {confidence.detail}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </div>
            )}
            {/* Revealed on hover like a user turn's actions; also while one
                has keyboard focus, or while the reply is being read aloud. */}
            <MessageActions className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-pressed=true]]:opacity-100">
              {onReply && <ReplyAction message={message} onReply={onReply} />}
              {copyAction}
              {onSpeak && message.message.trim() && (
                <SpeakAction message={message} onSpeak={onSpeak} />
              )}
            </MessageActions>
          </div>
        </div>
      </Message>
    );
  },
);

GroupMessage.displayName = "GroupMessage";

export default GroupMessage;
