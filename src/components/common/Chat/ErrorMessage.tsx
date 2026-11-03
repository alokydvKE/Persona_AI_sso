import { Message } from "@/components/ui/message"
import { AlertTriangle } from "lucide-react"
import { memo } from "react"
import { cn } from "@/lib/utils"
import { CHAT_COLUMN } from "./chatLayout"

const ErrorMessage = memo(({ error }: { error: Error }) => (
  <Message className={cn(CHAT_COLUMN, "not-prose flex flex-col items-start gap-2 px-0 md:px-10")}>
    <div className="group flex w-full flex-col items-start gap-0">
      <div className="text-primary flex min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border-2 border-red-300 bg-red-300/20 px-2 py-1">
        <AlertTriangle size={16} className="text-red-500" />
        <p className="text-red-500">{error.message}</p>
      </div>
    </div>
  </Message>
))

ErrorMessage.displayName = "ErrorMessage"

export default ErrorMessage;