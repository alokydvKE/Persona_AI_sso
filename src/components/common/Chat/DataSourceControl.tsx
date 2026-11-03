import { useState } from "react";
import { Database } from "lucide-react";


import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DataSourceOptionList from "./DataSourceOptionList";
import { cn } from "@/lib/utils";
import { useDataSourceOptions, type DataSourceKey } from "@/api/Chat/query";
import { useSetDataSource } from "@/api/Chat/mutation";

type Props = {
  conversationId: string;
  projectId: string | undefined;
  /** The conversation's pinned key; null until history loads. */
  value: DataSourceKey | null;
  /**
   * Whether the user has actually chosen. False means `value` is only what the
   * chat WOULD build from — the chip prompts for a choice and the chat's
   * composer stays locked until one is made.
   */
  selected: boolean;
  /** True once the build was dispatched — the key is frozen server-side. */
  locked: boolean;
  onChanged: (next: DataSourceKey) => void;
  /** Dialog open state, controlled so the composer's prompt can open it too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The chat toolbar's data-source chip: which dataset this build reads, and — up
 * until the build starts — a way to change it.
 *
 * The chip is always visible, not just when it is changeable. A build's evidence
 * comes from this choice, so the transcript should say which one it was long
 * after the build is done; that is also why it goes read-only (rather than
 * disappearing) once locked.
 *
 * This is the ONLY place the dataset is chosen — starting a chat does not ask —
 * so while it is still changeable the chip is drawn as a real control rather
 * than a label, and reverts to a plain label once the build has frozen it.
 *
 * Changing is a two-step commit: pick, then confirm. The choice decides which
 * data every persona in the build is evidenced from and cannot be corrected
 * afterwards, so the dialog restates the dataset by name instead of asking a
 * bare "are you sure?".
 */
function DataSourceControl({
  conversationId,
  projectId,
  value,
  selected,
  locked,
  onChanged,
  open,
  onOpenChange,
}: Props) {
  const [draft, setDraft] = useState<DataSourceKey | null>(value);

  // Only fetched while the dialog is open: a chip that just displays the current
  // dataset needs the label, not the project's availability matrix.
  const { data, isLoading } = useDataSourceOptions(open ? projectId : undefined);
  const setMut = useSetDataSource(conversationId);

  /** Open with the draft reset to what is actually pinned, so a cancelled change
   *  never carries into the next one. */
  const openDialog = () => {
    setDraft(selected ? value : null);
    onOpenChange(true);
  };

  const options = data?.options ?? [];
  const current = options.find((o) => o.key === value);
  // Before the options load (or when the chip renders without ever opening the
  // dialog) fall back to the key itself, so the chip is never blank.
  const currentLabel = current?.label ?? LABELS[value ?? "master"];

  const commit = () => {
    if (!draft) return;
    // Re-confirming the same key still has to reach the server the first time:
    // that write is what turns "would build from master" into "chose master".
    if (draft === value && selected) {
      onOpenChange(false);
      return;
    }
    setMut.mutate(
      { dataSource: draft },
      {
        onSuccess: (res) => {
          onChanged(res.data_source);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "shrink-0",
          // Locked still reads as a chip (it records which data was used) but
          // stops looking clickable.
          locked && "cursor-default text-muted-foreground hover:bg-background hover:text-muted-foreground",
          // Unchosen is the chat's blocking state, so the chip asks rather than
          // reports, and is styled to be the obvious next thing to click.
          !selected && !locked && "border-primary/50 text-primary",
        )}
        onClick={() => !locked && openDialog()}
        // Locked is presented as a non-interactive chip rather than a disabled
        // button: there is nothing the user did wrong, and a greyed-out control
        // reads as an error state.
        aria-disabled={locked}
        title={
          locked
            ? `Built from ${currentLabel}`
            : selected
              ? `Building from ${currentLabel} — click to change`
              : "Choose which data to build from"
        }
      >
        <Database aria-hidden="true" />
        <span className="max-w-[40vw] truncate">
          {selected ? currentLabel : "Select data source"}
        </span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !setMut.isPending) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Change data source" : "Choose a data source"}
            </DialogTitle>
            <DialogDescription>
              Personas in this chat are evidenced from the data you pick. You can
              change it while you talk, but not once the build starts.
            </DialogDescription>
          </DialogHeader>

          <DataSourceOptionList
            options={options}
            value={draft}
            onChange={setDraft}
            isLoading={isLoading}
            disabled={setMut.isPending}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={setMut.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={commit}
              disabled={!draft || setMut.isPending}
            >
              {setMut.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Fallback labels for the chip before the options request has run. */
const LABELS: Record<DataSourceKey, string> = {
  master: "Master data",
  uploaded: "My uploaded data",
  combined: "Master + my uploaded data",
};

export default DataSourceControl;
