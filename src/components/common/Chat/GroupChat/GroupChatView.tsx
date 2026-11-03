import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  EllipsisVertical,
  ImagePlus,
  Loader2,
  Mic,
  MoveRight,
  RefreshCcw,
  SlidersHorizontal,
  Square,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { StickToBottomContext } from "use-stick-to-bottom";

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/ui/chat-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  PageHeaderActions,
  PageHeaderTitle,
} from "@/components/global/PageHeader";
import { GradientRingLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN } from "../chatLayout";
import { personaColorStyle, personaInitials } from "@/lib/personaColors";
import { PICK_ITEM, PICK_MENU } from "@/lib/menuStyles";

import LoadingMessage from "../LoadingMessage";
import ErrorMessage from "../ErrorMessage";
import ChatComposer from "../ChatComposer";
import ChatEnded from "../ChatEnded";
import ChatHistorySkeleton from "../ChatHistorySkeleton";
import ChatScrollButton from "../ChatScrollButton";
import VoiceStatusBar from "../VoiceStatusBar";
import GroupMessage from "./GroupMessage";
import GroupParticipants from "./GroupParticipants";
import AssumptionsDialog from "./AssumptionsDialog";
import {
  replyThinkingPhrases,
  UPLOAD_THINKING,
  type ThinkingTurn,
} from "./groupChatThinking";

import {
  useGroupHistory,
  useGroupChatParticipants,
  useGroupAssumptions,
} from "@/api/GroupChat/query";
import { useChatList } from "@/api/Chat/query";
import {
  useDownloadGroupInsights,
  uploadGroupImages,
  useGroupSurveyPrompt,
  useGroupDownloadInsightsLimit,
  useGroupSurveyPromptLimit,
} from "@/api/GroupChat/mutation";
import { useGroupChatStream } from "@/api/GroupChat/useGroupChatStream";
import { useActiveProjectId } from "@/hooks/useActiveProjectId";
import { useLoadOlderOnScroll } from "@/hooks/useLoadOlderOnScroll";
import {
  useImageAttachments,
  IMAGE_ACCEPT,
  MAX_IMAGES,
} from "@/hooks/useImageAttachments";
import { useVoiceConfig } from "@/api/Voice/voice";
import { useMicRecorder } from "@/hooks/useMicRecorder";
import { useSpeakerPreference } from "@/hooks/useSpeakerPreference";
import { speechPlayer } from "@/lib/voice/speechPlayer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL = "all";

// Per-message "read aloud" button hidden for now — flip to true to bring it back.
const PER_MESSAGE_SPEAKER_BUTTON_ENABLED = false;

// Avatars shown in the recipient pill before it collapses the rest into "+N".
const RECIPIENT_AVATAR_LIMIT = 3;

const RECIPIENT_AVATAR =
  "flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-popover";

// Quiet icon buttons on the right of the composer, before send.
const COMPOSER_TOOL =
  "size-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground";

/**
 * The avatar stack inside the recipient pill when messaging everyone. Phones
 * get just the first avatar so the pill and the composer tools share one row.
 */
function RecipientAvatars({
  participants,
}: {
  participants: GroupParticipant[];
}) {
  if (participants.length === 0) {
    return (
      <span
        className={cn(RECIPIENT_AVATAR, "bg-primary/10 text-primary")}
        aria-hidden="true"
      >
        <Users className="size-3.5" />
      </span>
    );
  }
  const shown = participants.slice(0, RECIPIENT_AVATAR_LIMIT);
  const extra = participants.length - shown.length;
  return (
    <span className="flex -space-x-1.5" aria-hidden="true">
      {shown.map((p, i) => (
        <span
          key={p.persona_id}
          className={cn(
            RECIPIENT_AVATAR,
            personaColorStyle(p.color).avatar,
            i > 0 && "max-sm:hidden",
          )}
        >
          {personaInitials(p.persona_name)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            RECIPIENT_AVATAR,
            "bg-muted text-muted-foreground max-sm:hidden",
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

function GroupChatView() {
  const { groupId } = useParams();
  const projectId = useActiveProjectId();

  // History is owned by the pager (grows at the front on scroll-up); messages
  // sent in this session are appended locally at the end.
  const history = useGroupHistory(groupId);
  const [liveMessages, setLiveMessages] = useState<GroupMessageT[]>([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string>(ALL);
  const [ended, setEnded] = useState(false);
  // Set once this group's first user turn is sent — the turn that makes the
  // backend name the chat. Drives the Recents poll for that name (see below).
  const [awaitingTitle, setAwaitingTitle] = useState<string | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  // What the turn being waited on was (who it went to, images, assumptions),
  // fixed at send so its "thinking" lines describe that turn.
  const [thinkingTurn, setThinkingTurn] = useState<ThinkingTurn>({
    personaName: null,
    withImages: false,
    withAssumptions: false,
  });
  const replyPhrases = useMemo(
    () => replyThinkingPhrases(thinkingTurn),
    [thinkingTurn],
  );

  // Image attachments (broadcast-only) staged in the composer.
  const attachments = useImageAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Subscribed purely to rename the Recents entry once the backend has named
  // this chat: the list is shared cache, so the sidebar renders the new name
  // without knowing a poll happened.
  const { data: chatList } = useChatList(projectId, {
    awaitTitleFor: awaitingTitle ?? undefined,
  });
  // Shown in the top bar as "project › chat title".
  const chatTitle = chatList?.find(
    (c) => c.kind === "group" && c.id === groupId,
  )?.title;

  const participantsQuery = useGroupChatParticipants(groupId);
  const insightsMut = useDownloadGroupInsights(groupId ?? "");
  // Read only: the dialog owns every write. Shared cache key, so applying or
  // removing an assumption in there refreshes this badge with no extra request.
  const assumptionsQuery = useGroupAssumptions(groupId);
  const assumptionCount = assumptionsQuery.data?.assumptions.length ?? 0;

  const participants = useMemo(
    () => participantsQuery.data ?? [],
    [participantsQuery.data],
  );

  // Replies can land after the user has moved to another group chat (the view
  // is reused across routes); they must not be shown or spoken there.
  const groupIdRef = useRef(groupId);
  useEffect(() => {
    groupIdRef.current = groupId;
  }, [groupId]);

  // ---- Voice ----
  const voiceConfig = useVoiceConfig().data;
  const sttEnabled = Boolean(voiceConfig?.stt.enabled);
  const ttsEnabled = Boolean(voiceConfig?.tts.enabled);
  // The backend owns the recording limit; the hook has a fallback until it loads.
  const maxRecordingSeconds = voiceConfig?.limits?.max_recording_seconds;
  const [readAloudPref, setReadAloudPref] = useSpeakerPreference();
  const readAloud = ttsEnabled && readAloudPref;

  // Persona replies stream into `liveMessages` token by token.
  const stream = useGroupChatStream({ setLiveMessages, readAloud });
  const sending = stream.isStreaming || uploading;

  const messages = useMemo(
    () => [...history.messages, ...liveMessages],
    [history.messages, liveMessages],
  );
  const liveIds = useMemo(
    () => new Set(liveMessages.map((m) => m.id)),
    [liveMessages],
  );

  const colorByName = useMemo(() => {
    const map: Record<string, string> = {};
    participants.forEach((p) => (map[p.persona_name] = p.color));
    return map;
  }, [participants]);

  // Personas a reply can be addressed to: current participants not marked
  // inactive (a missing flag counts as active). Keyed by id, with a by-name
  // fallback for messages that carry no id — used only when the name is unique.
  const replyTargets = useMemo(() => {
    const byId = new Set<string>();
    const byName = new Map<string, string>();
    const ambiguous = new Set<string>();
    participants.forEach((p) => {
      if (p.active === false) return;
      byId.add(p.persona_id);
      if (byName.has(p.persona_name)) ambiguous.add(p.persona_name);
      else byName.set(p.persona_name, p.persona_id);
    });
    ambiguous.forEach((name) => byName.delete(name));
    return { byId, byName };
  }, [participants]);

  /** The participant a persona message can be replied to, if any. */
  const replyTargetOf = useCallback(
    (message: GroupMessageT): string | undefined => {
      if (message.role !== "persona") return undefined;
      if (message.persona_id) {
        return replyTargets.byId.has(message.persona_id)
          ? message.persona_id
          : undefined;
      }
      return message.persona_name
        ? replyTargets.byName.get(message.persona_name)
        : undefined;
    },
    [replyTargets],
  );

  // Edit: load a previous message's text back into the composer, then focus the
  // textarea (caret at the end) so it can be tweaked and re-sent.
  const composerRef = useRef<HTMLDivElement>(null);
  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = composerRef.current?.querySelector("textarea");
      if (textarea) {
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }
    });
  }, []);

  // Dictation lands in the input for review — it's never sent automatically.
  const mic = useMicRecorder({
    maxDurationMs: maxRecordingSeconds ? maxRecordingSeconds * 1000 : undefined,
    onTranscript: (text) => {
      setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));
      focusComposer();
    },
  });

  // Reset when navigating between group chats.
  useEffect(() => {
    setLiveMessages([]);
    setTarget(ALL);
    setEnded(false);
    setAwaitingTitle(null);
    setUploading(false);
    attachments.clear();
    // The server still finishes and saves a turn whose stream is dropped here.
    stream.cancel();
    speechPlayer.stop();
    mic.cancel();
    // attachments.clear, stream.cancel and mic.cancel are stable; intentionally
    // keyed on groupId only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Stop reading aloud on unmount (the stream hook drops its own turn).
  useEffect(() => () => speechPlayer.stop(), []);

  // The browser refused to play without a fresh click: turn auto-read off so
  // it doesn't keep failing; the user can switch it back on.
  useEffect(
    () => speechPlayer.onAutoplayBlocked(() => setReadAloudPref(false)),
    [setReadAloudPref],
  );

  const handleToggleReadAloud = () => {
    if (readAloudPref) {
      speechPlayer.stop();
      setReadAloudPref(false);
    } else {
      // Inside the click, so replies arriving later are allowed to play.
      speechPlayer.prime();
      setReadAloudPref(true);
    }
  };

  // While the mic is busy the rest of the bar is locked, so nothing else can
  // change under a dictation that is about to land in the input.
  const micBusy = mic.status !== "idle";

  const handleMicClick = () => {
    if (mic.status === "idle") speechPlayer.stop(); // don't read replies into the mic
    mic.toggle();
  };

  const handleSpeak = useCallback(
    (message: GroupMessageT) =>
      speechPlayer.toggle({
        id: message.id,
        text: message.message,
        speakerKey: message.persona_name,
        groupId: groupIdRef.current,
      }),
    [],
  );

  // Scroll-up loads older history while keeping the viewport anchored.
  const stbRef = useRef<StickToBottomContext | null>(null);
  const getScrollEl = useCallback(
    () => stbRef.current?.scrollRef.current ?? null,
    [],
  );
  useLoadOlderOnScroll({
    getScrollEl,
    ready: history.ready,
    hasOlder: history.hasOlder,
    isLoadingOlder: history.isLoadingOlder,
    loadOlder: history.loadOlder,
    signal: history.messages.length,
  });

  const handleEditMessage = useCallback(
    (text: string) => {
      setInput(text);
      focusComposer();
    },
    [focusComposer],
  );

  // Reply: address the next message to that persona (the recipient picker
  // shows who it goes to) and put the caret in the composer. The draft is kept.
  const handleReply = useCallback(
    (message: GroupMessageT) => {
      const personaId = replyTargetOf(message);
      if (!personaId) return;
      setTarget(personaId);
      focusComposer();
    },
    [replyTargetOf, focusComposer],
  );

  const appendLive = (next: GroupMessageT[]) =>
    setLiveMessages((prev) => [...prev, ...next]);

  const removeLive = (id: string) =>
    setLiveMessages((prev) => prev.filter((m) => m.id !== id));

  // File picker → validate + stage locally; surface the first rejection reason.
  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const { error } = attachments.addFiles(files);
      if (error) toast.error(error);
    }
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  };

  const selectedParticipant = participants.find((p) => p.persona_id === target);
  const targetName =
    target === ALL ? "Everyone" : selectedParticipant?.persona_name;

  const handleSend = () => {
    const text = input.trim();
    if (!text || !groupId || ended || sending || micBusy) return;

    // The backend names the chat from its first exchange, so only that turn is
    // worth watching for a rename.
    const isFirstUserMessage = !messages.some((m) => m.role === "user");

    // A new question interrupts whatever is still being read aloud.
    speechPlayer.stop();
    // Sending is a user gesture: unlock audio now, so replies that arrive
    // later (outside any gesture) may play.
    if (readAloud) speechPlayer.prime();
    const sentGroupId = groupId;
    const isCurrentGroup = () => groupIdRef.current === sentGroupId;

    // Take ownership of the staged images so their previews keep rendering in
    // the optimistic bubble.
    const staged = attachments.takeAll();
    setThinkingTurn({
      personaName:
        target === ALL ? null : (selectedParticipant?.persona_name ?? null),
      withImages: staged.length > 0,
      withAssumptions: assumptionCount > 0,
    });
    const userMsgId = crypto.randomUUID();
    setInput("");
    appendLive([
      {
        id: userMsgId,
        role: "user",
        message: text,
        images: staged.map((s) => ({ url: s.previewUrl, name: s.file.name })),
      },
    ]);

    // Send the turn once any images are uploaded. Broadcast (Everyone) and a
    // single-persona message both accept attachments.
    const sendToServer = (fileIds?: string[]) =>
      stream.send({
        groupId: sentGroupId,
        message: text,
        personaId: target === ALL ? undefined : target,
        fileIds,
        isCurrentGroup,
        onSaved: () => {
          if (isFirstUserMessage) setAwaitingTitle(sentGroupId);
        },
        onFailed: (message) => {
          if (/ended/i.test(message)) setEnded(true);
        },
      });

    if (staged.length === 0) {
      sendToServer();
      return;
    }

    // Upload the images first, then send with their file_ids. On failure, roll
    // back the optimistic bubble and restore the text + images to retry.
    setUploading(true);
    uploadGroupImages(
      groupId,
      staged.map((s) => s.file),
    )
      .then((fileIds) => {
        if (isCurrentGroup()) sendToServer(fileIds);
      })
      .catch((err: Error) => {
        if (!isCurrentGroup()) return;
        removeLive(userMsgId);
        setInput(text);
        attachments.restore(staged);
        toast.error(err?.message || "Couldn't upload images, please retry");
      })
      .finally(() => setUploading(false));
  };

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [insignDialogOpen, setInsignDialogOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const {
    mutateAsync: getDownloadInsightsLimit,
    data: downloadInsightsData,
    isPending: isDownloadInsightsLoading,
  } = useGroupDownloadInsightsLimit(groupId);

  const { mutateAsync: getSurveyPrompt, isPending: isSurveyPromptLoading } =
    useGroupSurveyPrompt(groupId);

  const [surveyPrompt, setSurveyPrompt] = useState("");
  const {
    mutateAsync: getSurveyPromptLimit,
    data: surveyPromptLimitData,
    isPending: isSurveyPromptLimitLoading,
  } = useGroupSurveyPromptLimit(groupId);

  // const handlePushToInsignAI = async () => {
  //   setPromptCopied(false);
  //   setSurveyPrompt("");
  //   setInsignDialogOpen(true);

  //   try {
  //     // Call the limit API before fetching the prompt.
  //     await getSurveyPromptLimit();

  //     // Fetch the survey prompt.
  //     const response = await getSurveyPrompt();
  //     const latestPrompt = response?.prompt ?? "";

  //     setSurveyPrompt(latestPrompt);

  //     // Call the limit API again after fetching the prompt.
  //     await getSurveyPromptLimit();
  //   } catch (error) {
  //     setSurveyPrompt("");
  //   }
  // };

  const handlePushToInsignAI = async () => {
    setPromptCopied(false);
    setSurveyPrompt("");
    setInsignDialogOpen(true);

    try {
      const response = await getSurveyPromptLimit();

      setSurveyPrompt(response?.prompt ?? "");
    } catch (error) {
      setSurveyPrompt("");
      toast.error("Failed to load the questionnaire prompt.");
    }
  };

  const handleGeneratePrompt = async () => {
    try {
      setPromptCopied(false);

      // Generate or regenerate the questionnaire prompt
      const response = await getSurveyPrompt();

      // Refresh the prompt limit data
      const limitResponse = await getSurveyPromptLimit();

      // Use the prompt returned by the prompt limit API
      setSurveyPrompt(limitResponse?.prompt ?? response?.prompt ?? "");
    } catch (error) {
      // toast.error("Failed to generate the questionnaire prompt.");
    }
  };

  const handleCopyInsignPrompt = async () => {
    if (!surveyPrompt) {
      toast.error("Prompt is not available.");
      return;
    }

    try {
      await navigator.clipboard.writeText(surveyPrompt);

      setPromptCopied(true);

      toast.success("Prompt copied successfully.");
    } catch {
      toast.error("Failed to copy prompt");
    }
  };
  const canAttach =
    !ended && !sending && !micBusy && attachments.items.length < MAX_IMAGES;

  if (participantsQuery.isError || history.isError) {
    return (
      <div className="flex h-[calc(100vh-90px)] items-center justify-center">
        <ErrorMessage
          error={{
            name: "GroupChatError",
            message: "Couldn't load this group chat.",
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-90px)] flex-col overflow-hidden duration-300 animate-in fade-in">
      <PageHeaderTitle
        title={chatTitle}
        status={ended ? { label: "Ended", tone: "neutral" } : undefined}
      />
      <PageHeaderActions>
        <GroupParticipants participants={participants} projectId={projectId} />
        <Button
          variant="outline"
          disabled={micBusy}
          onClick={() => setAssumptionsOpen(true)}
          // The label is hidden on narrow screens; keep the button named.
          aria-label={
            assumptionCount > 0
              ? `Assumptions (${assumptionCount} applied)`
              : "Assumptions"
          }
        >
          <SlidersHorizontal aria-hidden="true" />
          <span className="hidden sm:inline">Assumptions</span>
          {assumptionCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {assumptionCount}
            </span>
          )}
        </Button>
        {/* <Button
          variant="inverse"
          disabled={insightsMut.isPending || sending || messages.length === 0}
          onClick={() => insightsMut.mutate()}
          aria-label={
            insightsMut.isPending ? "Preparing insights…" : "Download insights"
          }
        >
          {insightsMut.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {insightsMut.isPending
              ? "Preparing insights…"
              : "Download insights"}
          </span>
        </Button> */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sending || messages.length === 0}
              aria-label="More actions"
              title="More actions"
            >
              <EllipsisVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              disabled={insightsMut.isPending}
              onClick={async () => {
                setDownloadDialogOpen(true);

                try {
                  await getDownloadInsightsLimit();
                } catch {
                  // Error can be handled in the dialog UI
                }
              }}
            >
              {/* {insightsMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )} */}
              <Download className="size-4 text-muted-foreground" />
              <span>Download Insights</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handlePushToInsignAI}>
              <MoveRight className="size-4 text-muted-foreground" />
              <span>Push to Insign AI</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeaderActions>

      <ChatContainerRoot
        contextRef={stbRef}
        className="relative flex-1 space-y-0 overflow-hidden"
      >
        <ChatContainerContent className="space-y-8 py-8">
          {/* Top-of-list spinner while older history loads. */}
          {history.isLoadingOlder && (
            <div className="flex justify-center py-2">
              <GradientRingLoader size="sm" />
            </div>
          )}

          {history.isInitialLoading ? (
            <ChatHistorySkeleton />
          ) : messages.length === 0 ? (
            <p
              className={cn(
                CHAT_COLUMN,
                "px-10 text-center text-sm text-muted-foreground",
              )}
            >
              Ask a question to hear from {participants.length || "your"}{" "}
              personas.
            </p>
          ) : (
            messages.map((message, index) => (
              <GroupMessage
                key={message.id}
                message={message}
                // Loaded history eases in top to bottom; this session's
                // messages appear at once.
                enterDelayMs={
                  liveIds.has(message.id) ? 0 : Math.min(index, 8) * 40
                }
                color={
                  message.persona_name
                    ? colorByName[message.persona_name]
                    : undefined
                }
                onEdit={ended || micBusy ? undefined : handleEditMessage}
                // Same locks as the recipient picker, plus a persona that can
                // still be messaged.
                onReply={
                  !ended && !micBusy && replyTargetOf(message)
                    ? handleReply
                    : undefined
                }
                onSpeak={
                  PER_MESSAGE_SPEAKER_BUTTON_ENABLED && ttsEnabled
                    ? handleSpeak
                    : undefined
                }
              />
            ))
          )}

          {/* While images upload, then until the first persona's reply
              appears. */}
          {(uploading || stream.isWaiting) && (
            <LoadingMessage
              phrases={uploading ? UPLOAD_THINKING : replyPhrases}
              label={
                uploading
                  ? "Uploading images"
                  : thinkingTurn.personaName
                    ? `${thinkingTurn.personaName} is replying`
                    : "Personas are replying"
              }
            />
          )}

          <ChatScrollButton />
        </ChatContainerContent>
      </ChatContainerRoot>

      {ended && <ChatEnded message="This discussion has ended" />}

      <ChatComposer
        rootRef={composerRef}
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={ended}
        isSending={sending}
        inputLocked={micBusy}
        statusBar={
          sttEnabled && micBusy ? (
            <VoiceStatusBar
              status={mic.status}
              stream={mic.stream}
              maxDurationMs={mic.maxDurationMs}
              onDiscard={mic.cancel}
            />
          ) : undefined
        }
        placeholder={
          target === ALL
            ? "Message everyone…"
            : `Message ${targetName ?? "persona"}…`
        }
        attachmentBar={
          attachments.items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attachments.items.map((it) => (
                <div key={it.id} className="relative">
                  <img
                    src={it.previewUrl}
                    alt={it.file.name}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => attachments.removeItem(it.id)}
                    aria-label={`Remove ${it.file.name}`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow ring-2 ring-background"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : undefined
        }
        leftSlot={
          <Select
            value={target}
            onValueChange={setTarget}
            disabled={ended || micBusy}
          >
            <SelectTrigger
              aria-label="Choose who to message"
              className="min-w-0 max-w-[240px] gap-2 rounded-full border-primary/15 bg-primary/5 py-1 pl-1.5 pr-3 text-primary hover:bg-primary/10 data-[size=default]:h-9 dark:bg-primary/10 dark:hover:bg-primary/15 [&>svg]:text-primary/70"
            >
              {target === ALL ? (
                <span className="flex min-w-0 items-center gap-2">
                  <RecipientAvatars participants={participants} />
                  <span className="truncate text-sm font-semibold">
                    Everyone
                  </span>
                </span>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      RECIPIENT_AVATAR,
                      personaColorStyle(selectedParticipant?.color).avatar,
                    )}
                    aria-hidden="true"
                  >
                    {personaInitials(selectedParticipant?.persona_name)}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {selectedParticipant?.persona_name}
                  </span>
                </span>
              )}
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="top"
              sideOffset={6}
              className={cn(PICK_MENU, "max-h-72")}
            >
              <SelectItem value={ALL} className={PICK_ITEM}>
                <span className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-3" />
                  </span>
                  Everyone
                </span>
              </SelectItem>
              {participants.map((p) => (
                <SelectItem
                  key={p.persona_id}
                  value={p.persona_id}
                  className={PICK_ITEM}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                        personaColorStyle(p.color).avatar,
                      )}
                    >
                      {personaInitials(p.persona_name)}
                    </span>
                    {p.persona_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rightSlot={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              hidden
              onChange={handlePickFiles}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={COMPOSER_TOOL}
              disabled={!canAttach}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              title="Attach images"
            >
              <ImagePlus size={18} />
            </Button>
            {sttEnabled && mic.supported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  COMPOSER_TOOL,
                  "relative",
                  mic.status === "recording" &&
                    "bg-destructive/10 text-destructive ring-2 ring-destructive/30 hover:bg-destructive/15 hover:text-destructive",
                )}
                disabled={
                  ended ||
                  mic.status === "requesting" ||
                  mic.status === "transcribing"
                }
                onClick={handleMicClick}
                aria-label={
                  mic.status === "recording"
                    ? "Stop recording"
                    : mic.status === "transcribing"
                      ? "Transcribing"
                      : "Record voice message"
                }
                aria-pressed={mic.status === "recording"}
                title={
                  mic.status === "recording"
                    ? "Stop recording"
                    : "Record voice message"
                }
              >
                {mic.status === "transcribing" ||
                mic.status === "requesting" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : mic.status === "recording" ? (
                  <Square size={14} className="animate-pulse fill-current" />
                ) : (
                  <Mic size={18} />
                )}
              </Button>
            )}
            {ttsEnabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  COMPOSER_TOOL,
                  readAloudPref && "text-primary hover:text-primary",
                )}
                disabled={micBusy}
                onClick={handleToggleReadAloud}
                aria-label={
                  readAloudPref
                    ? "Stop reading replies aloud"
                    : "Read replies aloud"
                }
                aria-pressed={readAloudPref}
                title={
                  readAloudPref ? "Reading replies aloud" : "Read replies aloud"
                }
              >
                {readAloudPref ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </Button>
            )}
          </>
        }
      />

      <AssumptionsDialog
        open={assumptionsOpen}
        onOpenChange={setAssumptionsOpen}
        groupId={groupId}
      />
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download insights</DialogTitle>
            <div className="py-2 text-sm text-muted-foreground">
              {isDownloadInsightsLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  You have downloaded{" "}
                  <span className="font-semibold text-foreground">
                    {downloadInsightsData?.used ?? 0}
                  </span>{" "}
                  out of{" "}
                  <span className="font-semibold text-foreground">
                    {downloadInsightsData?.limit ?? 0}
                  </span>{" "}
                  downloads.
                </>
              )}
            </div>
          </DialogHeader>

          <DialogFooter>
            <Button
              disabled={
                isDownloadInsightsLoading ||
                insightsMut.isPending ||
                (downloadInsightsData?.remaining ?? 0) <= 0
              }
              onClick={() => {
                toast.info("Download is in progress. This may take some time.");

                insightsMut.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Insights downloaded successfully.");
                  },
                  // onError: (error) => {
                  //   toast.error(
                  //     error?.message || "Failed to download insights.",
                  //   );
                  // },
                });

                setDownloadDialogOpen(false);
              }}
            >
              {insightsMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              {insightsMut.isPending ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={insignDialogOpen} onOpenChange={setInsignDialogOpen}>
        <DialogContent className="flex min-h-0 max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
          {/* Header */}
          <DialogHeader className="shrink-0 pr-8 sm:pr-0">
            <DialogDescription className="text-md font-semibold text-foreground">
              Your questionnaire prompt is ready. Please copy and paste it into
              OptiBot to continue.
            </DialogDescription>

            {/* <p className="text-sm text-muted-foreground">
              Please copy the prompt before proceeding to Insign AI, as you will
              need it to continue.
            </p> */}
          </DialogHeader>

          {/* Prompt Content */}
          <div className="relative min-h-0 flex-1">
            {/* Scrollable Prompt */}
            <div className="h-[60vh] sm:h-[70vh] overflow-auto rounded-lg border bg-muted/30 p-4">
              {isSurveyPromptLoading ? (
                <div className="flex min-h-125 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <span>Loading prompt...</span>
                </div>
              ) : surveyPrompt ? (
                <pre className="min-h-0 w-full whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                  {surveyPrompt}
                </pre>
              ) : (
                <div className="flex min-h-125 items-center justify-center">
                  <p className="text-center text-sm text-muted-foreground">
                    Prompt Not available.
                  </p>
                </div>
              )}
            </div>

            {/* Fixed Copy Button */}
            {surveyPrompt && !isSurveyPromptLoading && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-3 top-3 z-20 bg-background shadow-sm"
                onClick={handleCopyInsignPrompt}
                disabled={!surveyPrompt}
                aria-label="Copy prompt"
                title={promptCopied ? "Copied" : "Copy prompt"}
              >
                {promptCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 flex-col gap-3 border-t bg-background pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {isSurveyPromptLimitLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  You have generated{" "}
                  <span className="font-semibold text-foreground">
                    {surveyPromptLimitData?.used ?? 0}
                  </span>{" "}
                  out of{" "}
                  <span className="font-semibold text-foreground">
                    {surveyPromptLimitData?.limit ?? 0}
                  </span>{" "}
                  prompts.
                </>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                variant="inverse"
                onClick={handleGeneratePrompt}
                disabled={
                  isSurveyPromptLoading ||
                  isSurveyPromptLimitLoading ||
                  (surveyPromptLimitData?.remaining ?? 0) <= 0
                }
              >
                {(surveyPromptLimitData?.used ?? 0) > 0 && (
                  <RefreshCcw className="size-4" />
                )}
                {(surveyPromptLimitData?.used ?? 0) === 0
                  ? "Generate Prompt"
                  : "Regenerate Prompt"}
              </Button>

              <Button
                type="button"
                disabled={
                  !surveyPrompt ||
                  isSurveyPromptLoading ||
                  isSurveyPromptLimitLoading
                }
                onClick={() => {
                  if (!surveyPrompt) {
                    toast.info("No prompt available.");
                    return;
                  }

                  if (!promptCopied) {
                    toast.info(
                      "Before pushing to Insign AI, please copy the prompt using the copy icon.",
                    );
                    return;
                  }

                  window.open(
                    "https://platform.insignai.com/#/",
                    "_blank",
                    "noopener,noreferrer",
                  );

                  setInsignDialogOpen(false);
                }}
              >
                <MoveRight className="size-4" />
                Go To Insign AI
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GroupChatView;
