import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GradientRingLoader, TextShimmerLoader } from "@/components/ui/loader";
import { PageHeaderTitle } from "@/components/global/PageHeader";
import PersonaPanel from "./PersonaPanel";
import BuilderThinking from "./BuilderThinking";
import ChatComposer from "./ChatComposer";
import type { BuilderOpening } from "./builderOpening";

import { usePersonaList } from "@/api/Persona/query";
import { useProjectDataState } from "@/api/Projects/dataFiles";
import { useBuilderChatStart } from "@/api/Chat/mutation";
import { useChatList, type RecentChat } from "@/api/Chat/query";
import { useActiveProjectId } from "@/hooks/useActiveProjectId";
import { findActiveBuilderSession, upsertSession } from "@/lib/chatStore";
import { queryClient } from "@/provider";

function CenteredLoader({ text }: { text: string }) {
  return (
    <div className="flex h-[calc(100vh-90px)] flex-col items-center justify-center gap-4 duration-300 animate-in fade-in">
      <GradientRingLoader size="lg" />
      <TextShimmerLoader text={text} />
    </div>
  );
}

// Status lines while the conversation is being created. The last one stays up
// for however long the start takes.
const STARTING_PHRASES = [
  "Setting up your new chat…",
  "Getting the persona builder ready…",
  "Preparing a fresh workspace…",
  "Starting a new persona build…",
  "Getting ready to hear about your audience…",
  "Preparing the first question…",
  "Almost ready…",
  "Just a moment…",
] as const;

/**
 * Stand-in for the chat screen while a new builder conversation is created:
 * the same layout, with the builder "typing" where its greeting will appear
 * and the composer waiting. When the conversation exists the real chat takes
 * over in place and types the greeting out, so there is no full-screen loader
 * and no jump between screens.
 */
function BuilderStartingShell() {
  return (
    <div className="flex h-[calc(100vh-90px)] flex-col overflow-hidden duration-300 animate-in fade-in">
      <PageHeaderTitle title="New persona chat" />
      <div className="flex-1 overflow-hidden py-8">
        <BuilderThinking phrases={STARTING_PHRASES} label="Starting the persona builder" />
      </div>
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled
        disabledPlaceholder="Getting the persona builder ready…"
        placeholder="Describe your target persona…"
      />
    </div>
  );
}

function BuilderEntry({
  projectId,
  forceNew,
  serverActiveChat,
}: {
  projectId: string;
  forceNew: boolean;
  /**
   * The project's most recent non-ended builder chat per the server. Covers
   * what the local store can't: a new login, a cleared browser, another device.
   */
  serverActiveChat?: RecentChat;
}) {
  const navigate = useNavigate();
  const startMut = useBuilderChatStart();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const startedAttemptRef = useRef(-1);

  useEffect(() => {
    if (startedAttemptRef.current === attempt) return;
    startedAttemptRef.current = attempt;

    if (!forceNew) {
      const existing = findActiveBuilderSession(projectId);
      if (existing) {
        navigate(`/chat/${existing.id}`, { state: { projectId }, replace: true });
        return;
      }
      if (serverActiveChat) {
        // Re-index it locally so a hard refresh can still recover its project.
        upsertSession({
          id: serverActiveChat.id,
          kind: "builder",
          projectId,
          title: serverActiveChat.title,
        });
        navigate(serverActiveChat.to, { state: { projectId }, replace: true });
        return;
      }
    }

    // The chat opens immediately — no data-source step in front of it. The
    // dataset defaults to master server-side and is changed from the chip in the
    // chat toolbar, which stays editable right up until the build is dispatched.
    // Asking here would block every new chat with a decision most users never
    // need to make, to save a click for the few who do.
    startMut.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          if (!data?.id) {
            setFailed(true);
            return;
          }
          upsertSession({
            id: data.id,
            kind: "builder",
            projectId,
            title: "New persona chat",
          });
          queryClient.invalidateQueries({ queryKey: ["ChatList", projectId] });
          // Hand the greeting over so the chat can type it out at once rather
          // than waiting on its history request (see builderOpening.ts).
          // Passed verbatim: it must match the saved history text exactly, or
          // the typing restarts when the history takes over.
          const greeting = data.messages?.[0]?.content;
          const opening: BuilderOpening | undefined = greeting?.trim()
            ? { conversationId: data.id, message: greeting }
            : undefined;
          navigate(`/chat/${data.id}`, {
            state: opening ? { projectId, opening } : { projectId },
            replace: true,
          });
        },
        onError: () => setFailed(true),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (failed) {
    return (
      <div className="flex h-[calc(100vh-90px)] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn't start the persona builder.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return <BuilderStartingShell />;
}

function ChatEntry() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const projectId = useActiveProjectId();
  const routeState = state as
    | { forceNew?: boolean; fromUpload?: boolean }
    | null;
  const forceNew = Boolean(routeState?.forceNew);
  // Both are explicit "I want to chat now" intents — the upload page handing off
  // (skipped, or the pipeline finished), and the New persona chat button.
  // Without this the handoff would bounce straight back into the step it just
  // left. The flag lives in route state, not storage, so it lasts exactly one
  // navigation: returning to the project later re-reads the state, which is the
  // whole point of the step staying open until the project has real activity.
  const wantsChat = forceNew || Boolean(routeState?.fromUpload);

  const dataState = useProjectDataState(wantsChat ? undefined : projectId);
  const personasQuery = usePersonaList(forceNew ? undefined : projectId);
  // Shares the sidebar's ["ChatList", projectId] cache, so usually no extra request.
  const chatListQuery = useChatList(forceNew ? undefined : projectId);

  if (!projectId) {
    return (
      <div className="flex h-[calc(100vh-90px)] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          No project selected. Open a project from the dashboard to start.
        </p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (forceNew) {
    return <BuilderEntry key={`${projectId}:new`} projectId={projectId} forceNew />;
  }

  // Resolve the setup state BEFORE anything else: BuilderEntry creates a
  // conversation the moment it mounts, and a conversation created behind a
  // redirect to the upload step is one the user never asked for.
  if (!wantsChat) {
    if (dataState.isPending) {
      return <CenteredLoader text="Loading project…" />;
    }
    if (dataState.data?.upload_allowed) {
      return <Navigate to={`/upload/${projectId}`} replace />;
    }
    // A failed state lookup falls through to the chat rather than stranding the
    // user: the upload step is optional, the chat is the project.
  }

  if (personasQuery.isLoading) {
    return <CenteredLoader text="Loading project…" />;
  }

  const personas = personasQuery.data?.personas ?? [];

  if (personas.length === 0) {
    // Wait for the chat list before mounting BuilderEntry — it creates a chat as
    // soon as it mounts. A failed lookup falls through to a new chat, as before.
    if (chatListQuery.isLoading) {
      return <CenteredLoader text="Loading project…" />;
    }
    // The list is ordered most-recent activity first.
    const serverActiveChat = chatListQuery.data?.find(
      (c) => c.kind === "builder" && c.status?.toLowerCase() !== "ended",
    );
    return (
      <BuilderEntry
        key={projectId}
        projectId={projectId}
        forceNew={false}
        serverActiveChat={serverActiveChat}
      />
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-90px)] w-full max-w-5xl flex-col gap-4 px-4 duration-300 animate-in fade-in">
      <div className="flex items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-gradient-brand w-fit text-lg font-semibold">
            Personas
          </h2>
          <p className="text-xs text-muted-foreground">
            Chat with a persona, or select several for a group chat.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/chat", { state: { projectId, forceNew: true } })}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New persona chat
        </Button>
      </div>
      <PersonaPanel projectId={projectId} scrollHeight="flex-1 min-h-0" />
    </div>
  );
}

export default ChatEntry;
