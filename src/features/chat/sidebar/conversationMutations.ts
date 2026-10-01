import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiResponse } from "../../../lib/api";
import type { Conversation, Folder } from "./types";

export interface ConversationMutationsOptions {
  isMobile: boolean;
  onCloseDrawer: () => void;
  menuOpen: string | null;
  activeConversationId?: string;
  onFolderCreated?: () => void;
}

export function useConversationMutations({
  isMobile,
  onCloseDrawer,
  menuOpen,
  activeConversationId,
  onFolderCreated,
}: ConversationMutationsOptions) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async (folderId?: string) => {
      // No empty-chat spam: if the open conversation is known-empty, reuse
      // it instead of creating another empty one (navigating there is a
      // no-op when already open). Unknown cache state still creates.
      if (activeConversationId) {
        try {
          const cached = queryClient.getQueryData<{ success: boolean; data: { messages: unknown[] } }>([
            "messages",
            activeConversationId,
          ]);
          const msgs = cached?.data?.messages;
          if (Array.isArray(msgs) && msgs.length === 0) {
            const existing = queryClient.getQueryData<{ data?: { items?: Conversation[] } }>(["conversations"]);
            const row = existing?.data?.items?.find((c) => c.id === activeConversationId);
            if (row) return { success: true, data: { conversation: row } };
          }
        } catch {
          // fall through to create
        }
      }
      return apiFetch<ApiResponse<{ conversation: Conversation }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId })
        }
      );
    },
    onMutate: () => {
      // Instant feedback on click (anywhere inside the button): terminate any
      // in-flight response + clear the thread at once — the Chat view listens
      // for this and stops/aborts immediately instead of waiting for POST.
      try {
        window.dispatchEvent(new Event("chatapp:new-chat"));
      } catch {
        /* noop */
      }
      if (isMobile) onCloseDrawer();
    },
    onSuccess: (res) => {
      const conv = res.data.conversation;
      // Pre-fill empty messages cache + optimistically prepend to the sidebar
      // list so navigation feels instant; refetch happens in background.
      queryClient.setQueryData(["messages", conv.id], {
        success: true,
        data: { messages: [] },
      });
      const prepend = (old: unknown) => {
        const o = old as
          | { data?: { items?: Conversation[] } }
          | undefined;
        if (!o?.data?.items) return old;
        return {
          ...(o as object),
          data: {
            ...(o.data as object),
            items: [
              conv,
              (o.data.items as Conversation[]).filter(
                (c) => c.id !== conv.id
              ),
            ],
          },
        };
      };
      queryClient.setQueryData(["conversations"], prepend);
      queryClient.setQueryData(["conversations", ""], prepend);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${conv.id}`);
      if (isMobile) onCloseDrawer();
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<ApiResponse<{ folder: Folder }>>(
        "/api/folders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      onFolderCreated?.();
    }
  });

  const renameMutation = useMutation({
    mutationFn: (payload: { id: string; title: string }) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        `/api/conversations/${payload.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: payload.title })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  const moveMutation = useMutation({
    mutationFn: (payload: { id: string; folderId: string | null }) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        `/api/conversations/${payload.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: payload.folderId })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<{}>>(`/api/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  const pinMutation = useMutation({
    mutationFn: (payload: { id: string; pinned: boolean }) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        `/api/conversations/${payload.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: payload.pinned })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<{}>>(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      if (activeConversationId === menuOpen) {
        navigate("/");
      }
    }
  });

  return {
    createMutation,
    createFolderMutation,
    renameMutation,
    pinMutation,
    deleteMutation,
    moveMutation,
    deleteFolderMutation,
  };
}
