import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, ApiResponse } from "../../../lib/api";
import { readWebSearchArmed } from "../sidebarState";
import type { ChatMessage, TurnKind } from "../message/types";
import { detectRegenKind, detectTurnKind } from "./turnKind";
import type { UseChatMessagesOptions } from "./turnKind";

export const useChatMessages = ({
  conversationId,
  model,
  setStreaming,
  setActiveStreamId,
  cancelRef,
  streamAssistant,
  resolveModelForPrompt,
}: UseChatMessagesOptions) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  // Live phase of the in-flight turn for the "what is happening" status.
  const [activeTurnKind, setActiveTurnKind] = useState<TurnKind | null>(null);
  const messageSchema = useMemo(
    () => z.string().min(1, "Message is required").max(8000, "Message too long"),
    []
  );

  const { data: messageData } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      apiFetch<ApiResponse<{ messages: ChatMessage[] }>>(
        `/api/conversations/${conversationId}/messages`
      ),
    enabled: !!conversationId,
  });

  useEffect(() => {
    // Instant clear on conversation switch: prevents old chat flashing
    // while the new conversation's messages load, and makes "New chat"
    // feel immediate right after navigation (before the GET resolves).
    setMessages([]);
    setLastUserMessage("");
    setComposerError(null);
  }, [conversationId]);

  useEffect(() => {
    if (messageData?.data?.messages) {
      setMessages(messageData.data.messages);
    }
  }, [messageData, conversationId]);

  const sendMessage = async (text: string, images?: string[], opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean }) => {
    if (!conversationId) return;
    const trimmed = text.trim();
    const hasImages = !!images && images.length > 0;
    if (!trimmed && !hasImages) {
      setComposerError("Message is required");
      return;
    }
    if (trimmed) {
      const validation = messageSchema.safeParse(trimmed);
      if (!validation.success) {
        setComposerError(validation.error.errors[0]?.message || "Invalid message");
        return;
      }
    }
    setComposerError(null);
    setLastUserMessage(trimmed);
    const tempUserId = `local-user-${Date.now()}`;
    const tempAssistantId = `local-assistant-${Date.now()}`;
    // Pre-route media prompts to the configured image/video model so the
    // turn runs on a capable model instead of failing on the chat model.
    const turnModel = resolveModelForPrompt
      ? resolveModelForPrompt(trimmed)
      : model;
    // Web search defaults ON for every input; only an explicit OFF wins.
    const searchOn = opts?.webSearch ?? readWebSearchArmed();

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: "USER",
        content: trimmed,
        ...(hasImages ? { images: [...images!] } : {}),
      },
      {
        id: tempAssistantId,
        role: "ASSISTANT",
        content: "",
        status: "STREAMING",
        model: turnModel === "default" ? "default" : turnModel,
      },
    ]);
    setStreaming(true);
    setActiveStreamId(tempAssistantId);
    setActiveTurnKind(detectTurnKind(trimmed, opts));

    try {
      await streamAssistant(setMessages, {
        tempAssistantId,
        conversationId,
        userMessage: trimmed,
        images: hasImages ? images : undefined,
        selectedModel: turnModel,
        ...(opts?.research ? { research: true as const } : {}),
        ...(opts?.artifact ? { artifact: true as const } : {}),
        webSearch: searchOn,
      });
    } catch (err: any) {
      if (cancelRef.current) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? {
                ...m,
                content: err?.message || "Streaming failed",
                status: "ERROR",
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
      setActiveTurnKind(null);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const handleEditSubmit = async (messageId: string, text: string) => {
    if (!conversationId) {
      throw new Error("Missing conversation");
    }
    const validation = messageSchema.safeParse(text);
    if (!validation.success) {
      throw new Error(validation.error.errors[0]?.message || "Invalid message");
    }

    setStreaming(true);
    const tempAssistantId = `local-assistant-${Date.now()}`;
    setActiveStreamId(tempAssistantId);
    setActiveTurnKind(detectTurnKind(text));
    // Edited prompts re-route too: an edit that adds image/video intent
    // picks up the configured media model for the retry turn.
    const editModel = resolveModelForPrompt
      ? resolveModelForPrompt(text)
      : model;

    try {
      await apiFetch<ApiResponse<{ message: ChatMessage }>>(
        `/api/conversations/${conversationId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, pruneFollowing: true }),
        }
      );

      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === messageId);
        if (index === -1) return prev;
        const next = [...prev.slice(0, index + 1)];
        next[index] = { ...next[index], content: text, status: "COMPLETE" };
        next.push({
          id: tempAssistantId,
          role: "ASSISTANT",
          content: "",
          status: "STREAMING",
          model: editModel === "default" ? "default" : editModel,
        });
        return next;
      });

      await streamAssistant(setMessages, {
        tempAssistantId,
        conversationId,
        existingUserMessageId: messageId,
        selectedModel: editModel,
        webSearch: readWebSearchArmed(),
      });
    } catch (err: any) {
      if (cancelRef.current) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? {
                ...m,
                content: err?.message || "Streaming failed",
                status: "ERROR",
              }
            : m
        )
      );
      throw new Error(err?.message || "Streaming failed");
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
      setActiveTurnKind(null);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const handleRegenerate = async (messageId: string, newModel: string) => {
    if (!conversationId) return;

    // Find the user message preceding this assistant message
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex <= 0) return; // Should have a user message before it
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== "USER") return;

    setStreaming(true);
    // One-off override only: newModel goes to streamAssistant selectedModel
    // + the per-message badge below. Never call global setModel here, so the
    // composer's selected model is untouched (no PATCH /api/me/settings).
    setActiveStreamId(messageId);
    // Keep the status honest: quiz/image/video regenerations show their own
    // phase, everything else falls back to plain streaming dots.
    const regenTarget = messages[messageIndex];
    setActiveTurnKind(detectRegenKind(regenTarget, userMessage.content));

    // Optimistically update the UI to show loading state for the assistant message
    setMessages((prev) => {
      const next = [...prev];
      next[messageIndex] = {
        ...next[messageIndex],
        content: "", // Clear content to show spinner/loading
        status: "STREAMING",
        model: newModel,
      };
      return next;
    });

    try {
      // Use the existing user message ID to regenerate response
      await streamAssistant(setMessages, {
        tempAssistantId: messageId, // Reuse the same ID or generate a new one if we wanted to append.
        // Reusing replaces the message content in-place which is what "Regenerate" usually implies here.
        conversationId,
        existingUserMessageId: userMessage.id,
        selectedModel: newModel,
        webSearch: readWebSearchArmed(),
      });
    } catch (err: any) {
      if (cancelRef.current) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: err?.message || "Regeneration failed",
                status: "ERROR",
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
      setActiveTurnKind(null);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  };

  return {
    messages,
    setMessages,
    lastUserMessage,
    composerError,
    setComposerError,
    messageData,
    activeTurnKind,
    setActiveTurnKind,
    sendMessage,
    handleEditSubmit,
    handleRegenerate,
  };
};

export type ChatMessagesApi = ReturnType<typeof useChatMessages>;
