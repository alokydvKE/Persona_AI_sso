import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CircularLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

import {
  groupSuggestionsKey,
  useGroupAssumptions,
  useHeldSuggestions,
} from "@/api/GroupChat/query";
import {
  useAddAssumption,
  useRemoveAssumption,
  useSuggestAssumptions,
} from "@/api/GroupChat/mutation";

type AssumptionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | undefined;
};

/** A rejected submission, held until the user takes the replacement or dismisses it. */
type Rejection = {
  text: string;
  reason: string;
  replacement: string | null;
  /** Signature for `replacement`, so applying it skips a second validation. */
  replacementToken: string | null;
};

/**
 * Manage the assumptions applied to a group chat — statements every persona
 * treats as true when replying.
 *
 * Two ways in, both ending at the same applied list:
 *   * "Suggest" asks the model for statements that fit these personas; applying
 *     one is instant, because the model wrote it and it is already valid.
 *   * Typing your own sends it to be validated first. If it comes back rejected
 *     the reason is shown along with a suggested rewrite that can be applied in
 *     one click.
 *
 * The validator returns a `reason` on every verdict, but only the rejection
 * shows it. On a suggestion or an applied row it explains a decision the user
 * did not have to make, and a second line of grey text under each row costs more
 * in scanning than it returns. On a rejection it is the whole point: it is the
 * only place the user is told why their own wording did not stick.
 *
 * The applied list is read from the server, so it survives a reload. The
 * suggestions are not: nothing about them is stored server-side. They live in
 * the query cache (``useHeldSuggestions``) for the rest of the session, so
 * closing the dialog does not throw them away, and are proven with a signed
 * token when applied. Losing them on a reload costs one button press, which is
 * a better trade than a database write per press.
 */
function AssumptionsDialog({
  open,
  onOpenChange,
  groupId,
}: AssumptionsDialogProps) {
  const [draft, setDraft] = useState("");
  const [rejection, setRejection] = useState<Rejection | null>(null);
  /**
   * Which row is mid-flight, so only that one shows a spinner. Keyed by
   * assumption_id for applied rows and by text for suggestions, which have no
   * id until they are applied.
   */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const cache = useQueryClient();
  const query = useGroupAssumptions(open ? groupId : undefined);
  const suggestions = useHeldSuggestions(groupId).data ?? [];
  const suggestMut = useSuggestAssumptions(groupId ?? "");
  const addMut = useAddAssumption(groupId ?? "");
  const removeMut = useRemoveAssumption(groupId ?? "");

  const applied = query.data?.assumptions ?? [];
  const maxAllowed = query.data?.max_allowed ?? 0;
  const atCapacity = maxAllowed > 0 && applied.length >= maxAllowed;

  // Start clean each time the dialog opens: a stale rejection or a suggestion
  // list from a previous visit would be confusing next to a re-fetched list.
  // Adjusted during render rather than in an effect — the state depends only on
  // `open` changing, and resetting in an effect would render the stale values
  // once first. https://react.dev/learn/you-might-not-need-an-effect
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      // The draft and any rejection belong to the last visit and would be
      // confusing beside a re-fetched list. The suggestions deliberately stay:
      // they are still valid for this group, and re-asking costs an LLM call.
      setDraft("");
      setRejection(null);
      setBusyKey(null);
    }
  }

  /** Drop anything from the suggestion strip that is now applied. */
  const dropSuggestion = (text: string) =>
    cache.setQueryData<AssumptionSuggestion[]>(
      groupSuggestionsKey(groupId),
      (prev) => (prev ?? []).filter((s) => s.text !== text),
    );

  // The mutation writes the new round straight to the cache, replacing the last.
  const handleSuggest = () => suggestMut.mutate(undefined);

  const handleApplySuggestion = (suggestion: AssumptionSuggestion) => {
    setBusyKey(suggestion.text);
    addMut.mutate(
      { text: suggestion.text, suggestionToken: suggestion.token },
      {
        onSuccess: () => dropSuggestion(suggestion.text),
        onSettled: () => setBusyKey(null),
      },
    );
  };

  const handleSubmitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setRejection(null);
    addMut.mutate(
      { text },
      {
        onSuccess: (result) => {
          if (result.status === "approved") {
            setDraft("");
            return;
          }
          // Kept in view so the user can act on the reason rather than
          // guessing why their wording did not stick.
          setRejection({
            text: result.text,
            reason: result.reason,
            replacement: result.suggested_assumption,
            replacementToken: result.suggested_token,
          });
        },
      },
    );
  };

  const handleTakeReplacement = () => {
    if (!rejection?.replacement) return;
    addMut.mutate(
      {
        text: rejection.replacement,
        suggestionToken: rejection.replacementToken,
      },
      {
        onSuccess: (result) => {
          if (result.status === "approved") {
            setDraft("");
            setRejection(null);
          }
        },
      },
    );
  };

  const handleRemove = (assumptionId: string) => {
    setBusyKey(assumptionId);
    removeMut.mutate(
      { assumptionId },
      { onSettled: () => setBusyKey(null) },
    );
  };

  const submitting = addMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assumptions</DialogTitle>
          <DialogDescription>
            Statements every persona treats as true when replying. They apply
            from your next message onwards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* ---------------- Applied ---------------- */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Applied</h3>
              {maxAllowed > 0 && (
                <span
                  className={cn(
                    "text-xs",
                    atCapacity ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {applied.length} of {maxAllowed}
                </span>
              )}
            </div>

            {query.isPending ? (
              <div className="flex justify-center py-4">
                <CircularLoader size="sm" />
              </div>
            ) : applied.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No assumptions yet. Add one below, or get suggestions.
              </p>
            ) : (
              <ScrollArea className="max-h-44">
                <ul className="flex flex-col gap-1.5 pr-3">
                  {applied.map((item) => (
                    <li
                      key={item.assumption_id}
                      className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 text-sm leading-snug">
                        {item.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(item.assumption_id)}
                        disabled={busyKey === item.assumption_id}
                        aria-label={`Remove assumption: ${item.text}`}
                      >
                        {busyKey === item.assumption_id ? (
                          <CircularLoader size="sm" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </section>

          {/* ---------------- Add your own ---------------- */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Add your own</h3>
            <div className="flex items-start gap-2">
              <Input
                value={draft}
                placeholder="e.g. Product costs $34.99 for a 12 lb bag"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) {
                    e.preventDefault();
                    handleSubmitDraft();
                  }
                }}
                disabled={atCapacity || submitting}
                aria-label="New assumption"
              />
              <Button
                onClick={handleSubmitDraft}
                disabled={!draft.trim() || atCapacity || submitting}
              >
                {submitting ? (
                  <CircularLoader size="sm" className="border-white" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="ml-1.5">Add</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Checked against these personas before it is applied.
            </p>

            {/* A rejection, with the offered rewrite. */}
            {rejection && (
              <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-900">
                      That one wasn&apos;t applied
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      {rejection.reason}
                    </p>
                  </div>
                </div>

                {rejection.replacement && (
                  <div className="rounded border border-amber-200 bg-white/70 px-2.5 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                      <Lightbulb className="h-3 w-3" />
                      Try this instead
                    </p>
                    <p className="mt-1 text-sm text-amber-950">
                      {rejection.replacement}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejection(null)}
                  >
                    Dismiss
                  </Button>
                  {rejection.replacement && (
                    <Button
                      size="sm"
                      onClick={handleTakeReplacement}
                      disabled={submitting || atCapacity}
                    >
                      Use this instead
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ---------------- Suggestions ---------------- */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Suggestions</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggest}
                disabled={suggestMut.isPending || atCapacity}
              >
                {suggestMut.isPending ? (
                  <CircularLoader size="sm" className="mr-1.5" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                {suggestions.length > 0 ? "Suggest more" : "Suggest"}
              </Button>
            </div>

            {suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Get ideas that fit these personas — pricing, claims, promotions,
                availability.
              </p>
            ) : (
              // Two rows tall. The cap leaves a sliver of the third row visible
              // rather than cutting cleanly at a row boundary, so it reads as
              // "there is more below" instead of looking like the end of the list.
              <ScrollArea className="max-h-32">
                <ul className="flex flex-col gap-1.5 pr-3">
                  {suggestions.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2"
                    >
                      <p className="min-w-0 flex-1 text-sm leading-snug">
                        {item.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                        onClick={() => handleApplySuggestion(item)}
                        disabled={busyKey === item.text || atCapacity}
                        aria-label={`Apply assumption: ${item.text}`}
                      >
                        {busyKey === item.text ? (
                          <CircularLoader size="sm" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </section>

          {atCapacity && (
            <p className="text-xs text-destructive">
              You&apos;ve reached the maximum. Remove one to add another.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssumptionsDialog;
