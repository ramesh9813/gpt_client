import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../lib/api";

const HomeRedirect = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Array<{ id: string }> }>>(
        "/api/conversations"
      )
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
    if (isLoading) return;
    const conversations = data?.data?.items || [];
    if (conversations.length > 0) {
      navigate(`/c/${conversations[0].id}`, { replace: true });
    } else if (!createMutation.isPending) {
      createMutation.mutate();
    }
  }, [data, isLoading, navigate, createMutation]);

  return <div className="p-6">Loading...</div>;
};

export default HomeRedirect;