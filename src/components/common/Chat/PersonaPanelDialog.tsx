import { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PersonaPanel from "./PersonaPanel";
import { useBuilderPersonas } from "@/api/Persona/query";
import { builderChatIdFromPath, useActiveProjectId } from "@/hooks/useActiveProjectId";
import { setPersonaDialog } from "@/redux/ProjectSlice";
import type { AppDispatch, RootState } from "@/redux/store";

/**
 * The persona panel as a dialog, used by the sidebar "Start Group Chat" action.
 * Controlled globally via redux `personaDialog`; the inline project dashboard
 * (ChatEntry) renders the same PersonaPanel content directly.
 *
 * Opened from inside a builder chat, it marks the personas that chat built, so
 * they stand out among the project's others.
 */
function PersonaPanelDialog() {
  const open = useSelector((s: RootState) => s.Project.personaDialog);
  const focusPersonaId = useSelector((s: RootState) => s.Project.personaDialogFocus);
  const dispatch = useDispatch<AppDispatch>();
  const projectId = useActiveProjectId();
  const { pathname } = useLocation();

  // Same request (and cache) as the chat's Build results panel. Only while
  // open, and only in a builder chat.
  const builderChatId = builderChatIdFromPath(pathname);
  const chatBuild = useBuilderPersonas(open ? builderChatId : undefined);
  const chatPersonaIds = useMemo(
    () => new Set((chatBuild.data?.personas ?? []).map((p) => p.persona_id)),
    [chatBuild.data?.personas],
  );

  const close = () => dispatch(setPersonaDialog(false));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Persona Panel</DialogTitle>
          <DialogDescription>
            Chat with a single persona, or select several and start a group chat.
          </DialogDescription>
        </DialogHeader>
        {/* Only fetch while the dialog is open. */}
        <PersonaPanel
          projectId={open ? projectId : undefined}
          onStarted={close}
          focusPersonaId={focusPersonaId}
          chatPersonaIds={chatPersonaIds}
        />
      </DialogContent>
    </Dialog>
  );
}

export default PersonaPanelDialog;
