import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import { apiFetch, ApiResponse } from "../lib/api";
import type { ChatMessage } from "../features/chat/message/types";

type UseNewChatOptions = {
  cancelRef: MutableRefObject<boolean>;
  setStreaming: (value: boolean) => void;
  setActiveStreamId: (value: string | null) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export const useNewChat = ({
  cancelRef,
  setStreaming,
  setActiveStreamId,
  setMessages,
}: UseNewChatOptions) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const newChatMutation = useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<{ conversation: { id: string } }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      ),
    onMutate: () => {
      // Instant feedback: clear thread + stop any stream while POST is in
      // flight, so the UI feels immediate instead of waiting on network.
      try {
        cancelRef.current = true;
      } catch {
        /* noop */
      }
      setStreaming(false);
      setActiveStreamId(null);
      setMessages([]);
    },
    onSuccess: (res) => {
      const conv = res.data.conversation as { id: string };
      // Pre-fill empty messages cache so the new thread renders instantly
      // without waiting for the GET /messages round-trip.
      queryClient.setQueryData(["messages", conv.id], {
        success: true,
        data: { messages: [] },
      });
      // Optimistically prepend to sidebar caches so the list updates without
      // waiting for a full refetch of up to 100 conversations.
      const prepend = (old: unknown) => {
        const o = old as {
          data?: { items?: Array<{ id: string }> };
        } | undefined;
        if (!o?.data?.items) return old;
        return {
          ...(o as object),
          data: {
            ...(o.data as object),
            items: [
              conv,
              ...(o.data.items as Array<{ id: string }>).filter(
                (c) => c.id !== conv.id
              ),
            ],
          },
        };
      };
      queryClient.setQueryData(["conversations"], prepend);
      queryClient.setQueryData(["conversations", ""], prepend);
      // Background revalidation (non-blocking — navigation happens first).
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${conv.id}`);
    },
  });

  return newChatMutation;
};
