import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CHAT_COLUMN } from "./chatLayout";

/**
 * Placeholder while a chat's history loads. It stays invisible for its first
 * moments and then fades in, so a quick load goes straight to the messages
 * without a skeleton flashing up and vanishing.
 */
function ChatHistorySkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="chat-history-skeleton"
      className={cn(
        CHAT_COLUMN,
        "flex flex-col gap-10 px-2 py-2 delay-200 duration-300 fill-mode-backwards animate-in fade-in motion-reduce:animate-none md:px-10",
      )}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-9 w-1/2 rounded-3xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}

export default ChatHistorySkeleton;
