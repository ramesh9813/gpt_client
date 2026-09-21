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

  const handleNextRound = useCallback(
    (topic: string) => {
      const t = topic?.trim() ?? "";
      void sendMessage(t ? `mcq ${t}` : "mcq");
    },
    [sendMessage]
  );

  return { handleQuizSelect, handleNextRound };
};
