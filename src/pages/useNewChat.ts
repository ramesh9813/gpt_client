import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import { apiFetch, ApiResponse } from "../lib/api";
import type { ChatMessage } from "../features/chat/message/types";

type UseNewChatOptions = {
  cancelRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  setStreaming: (value: boolean) => void;
  setActiveStreamId: (value: string | null) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  conversationId?: string;
};

export const useNewChat = ({
  cancelRef,
  abortControllerRef,
  setStreaming,
  setActiveStreamId,
  setMessages,
  conversationId,
}: UseNewChatOptions) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const newChatMutation = useMutation({
    mutationFn: async () => {
      // No empty-chat spam: reuse the open conversation when it has no
      // messages yet instead of stacking another empty one.
      if (conversationId) {
        try {
          const cached = queryClient.getQueryData<{ success: boolean; data: { messages: unknown[] } }>([
            "messages",
            conversationId,
          ]);
          const msgs = cached?.data?.messages;
          if (Array.isArray(msgs) && msgs.length === 0) {
            const existing = queryClient.getQueryData<{ data?: { items?: Array<{ id: string }> } }>(["conversations"]);
            const row = existing?.data?.items?.find((c) => c.id === conversationId);
            if (row) {
              // Ghost-id guard: the row may live in client cache only (the
              // server GCs day-old empty chats; deletes happen on other
              // devices). Reusing a dead id makes every send fail with
              // "Conversation not found" regardless of model — confirm it
              // still exists, otherwise fall through and create fresh.
              try {
                await apiFetch(`/api/conversations/${conversationId}/messages`);
                return { success: true, data: { conversation: row } } as ApiResponse<{ conversation: { id: string } }>;
              } catch {
                // fall through to create
              }
            }
          }
        } catch {
          // fall through to create
        }
      }
      return apiFetch<ApiResponse<{ conversation: { id: string } }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      );
    },
    onMutate: () => {
      // Instant feedback: kill any in-flight response (aborts the SSE
      // connection, not just a flag) + clear thread while POST is in
      // flight, so the UI feels immediate instead of waiting on network.
      try {
        abortControllerRef.current?.abort();
      } catch {
        /* noop */
      }
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
