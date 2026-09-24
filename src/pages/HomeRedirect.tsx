import "./HomeRedirect.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../lib/api";
import { loadLastConversationId } from "../features/chat/sidebarState";
import { readCachedConversations, writeCachedConversations } from "../features/chat/chatCache";

const HomeRedirect = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Instant path: last-open chat from localStorage. Rendered thread shows
  // immediately while React Query loads the real data underneath.
  const [storedId] = useState(() => loadLastConversationId());
  // Second instant path: cached conversation list (no stored id, e.g. new
  // device login expired or cache cleared elsewhere).
  const [cachedList] = useState(() => readCachedConversations());
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Array<{ id: string; title?: string; folderId?: string | null; updatedAt?: string }> }>>(
        "/api/conversations"
      ),
    enabled: !storedId && !cachedList,
    staleTime: 1000 * 30,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<{ conversation: { id: string } }>>(
        "/api/conversations",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/c/${res.data.conversation.id}`, { replace: true });
    }
  });

  useEffect(() => {
    // Smoothness first: jump straight to the stored chat, no network wait.
    if (storedId) {
      navigate(`/c/${storedId}`, { replace: true });
      return;
    }
    // Second instant path: cached list paints without waiting for DB.
    if (cachedList && cachedList.length > 0) {
      navigate(`/c/${cachedList[0].id}`, { replace: true });
      return;
    }
    if (isLoading) return;
    const conversations = data?.data?.items || [];
    if (conversations.length > 0) {
      writeCachedConversations(conversations as never);
      navigate(`/c/${conversations[0].id}`, { replace: true });
    } else if (!createMutation.isPending) {
      createMutation.mutate();
    }
  }, [data, isLoading, navigate, createMutation, storedId, cachedList]);

  return (
      <div className="homeredirect-loading" role="status" aria-label="Loading">
        <span className="loading-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    );
};

export default HomeRedirect;
