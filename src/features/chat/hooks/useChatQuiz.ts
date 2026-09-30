import { useCallback, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "../../../lib/api";
import type { ChatMessage } from "../message/types";
import type { QuizRound } from "../message/types";

type UseChatQuizOptions = {
  conversationId: string | undefined;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  sendMessage: (text: string) => void | Promise<void>;
};

export const useChatQuiz = ({
  conversationId,
  setMessages,
  sendMessage,
}: UseChatQuizOptions) => {
  // MCQ quiz: optimistic local update + best-effort persist (no refetch loop).
  const handleQuizSelect = useCallback(
    (messageId: string, quiz: QuizRound) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, quiz } : m))
      );
      if (!conversationId) return;
      const cid = conversationId;
      void apiFetch(`/api/conversations/${cid}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz }),
      }).catch(() => undefined);
    },
    [conversationId, setMessages]
  );

  // Next round sends only the short continuation text — the server
  // resolves the topic from this conversation's latest quiz (history binds
  // the context), so the full prompt is never re-sent by the client.
  const handleNextRound = useCallback(
    (_topic: string) => {
      void sendMessage("mcq next round");
    },
    [sendMessage]
  );

  return { handleQuizSelect, handleNextRound };
};
