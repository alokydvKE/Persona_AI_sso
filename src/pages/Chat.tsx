import { useParams } from "react-router";
import ConversationPromptInput from "@/components/common/Chat/ConversationPromptInput";
import ChatEntry from "@/components/common/Chat/ChatEntry";

const ChatPage = () => {
  const { id } = useParams();

  return (
    <div className="h-full overflow-hidden py-4 md:py-4">
      {id ? <ConversationPromptInput key={id} /> : <ChatEntry />}
    </div>
  );
};

export default ChatPage;
