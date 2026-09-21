import "./HomeRedirect.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../lib/api";
import { loadLastConversationId } from "../features/chat/sidebarState";

const HomeRedirect = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Instant path: last-open chat from localStorage. Rendered thread shows
  // immediately while React Query loads the real data underneath.
  const [storedId] = useState(() => loadLastConversationId());
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Array<{ id: string }> }>>(
        "/api/conversations"
      ),
    enabled: !storedId,
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
    if (isLoading) return;
    const conversations = data?.data?.items || [];
    if (conversations.length > 0) {
      navigate(`/c/${conversations[0].id}`, { replace: true });
    } else if (!createMutation.isPending) {
      createMutation.mutate();
    }
  }, [data, isLoading, navigate, createMutation, storedId]);

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
