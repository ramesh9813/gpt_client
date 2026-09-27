import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, ApiResponse } from "../../../lib/api";
import { getActiveByok, stripProviderPrefix } from "../../../lib/byok";
import { readWebSearchArmed } from "../sidebarState";

// Thinking mode mirrors webSearch: sticky localStorage flag honored by
// edits and regenerations too, not just fresh sends.
export const readThinkingArmed = (): boolean => {
  try {
    return window.localStorage.getItem("chatapp.think.armed") === "true";
  } catch {
    return false;
  }
};
import { readCachedMessages, writeCachedMessages } from "../chatCache";
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
  // Step 1: instant paint from localStorage (synchronous, zero network).
  // Step 2 (below): background DB fetch overwrites + re-caches.
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    readCachedMessages(conversationId) ?? []
  );
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  // Live ref: resend reads the latest thread even if its row memo-skipped a
  // re-render (UserMessage ignores volatile callbacks in its comparator).
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  // Live phase of the in-flight turn for the "what is happening" status.
  const [activeTurnKind, setActiveTurnKind] = useState<TurnKind | null>(null);
  const messageSchema = useMemo(
    () => z.string().min(1, "Message is required").max(8000, "Message too long"),
    []
  );

  const { data: messageData, isPending: messagesPending } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      apiFetch<ApiResponse<{ messages: ChatMessage[] }>>(
        `/api/conversations/${conversationId}/messages`
      ),
    enabled: !!conversationId,
    // Cache-first shell: DB is the source of truth but never blocks paint.
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: true,
  });

  useEffect(() => {
    // Instant switch: paint cached thread (or empty) immediately, then let
    // the background query above fill in the DB truth. No flash of old chat.
    const cached = readCachedMessages(conversationId);
    setMessages(cached ?? []);
    setLastUserMessage("");
    setComposerError(null);
  }, [conversationId]);

  useEffect(() => {
    if (messageData?.data?.messages) {
      setMessages(messageData.data.messages);
      // Step 2 complete: persist DB truth for the next instant paint.
      writeCachedMessages(conversationId, messageData.data.messages);
    }
  }, [messageData, conversationId]);

  // Persist settled turns too so a reload between refetches keeps them.
  // Skipped while streaming (temp local-* ids + high-frequency token writes).
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    if (messages.some((m) => String(m.id || "").startsWith("local-"))) return;
    if (messages.some((m) => m.status === "STREAMING")) return;
    writeCachedMessages(conversationId, messages);
  }, [conversationId, messages]);

  const sendMessage = async (text: string, images?: string[], opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean; think?: boolean }) => {
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
        ...(opts?.think ? { think: true as const } : {}),
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
                error: err?.message || "Streaming failed",
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

  const handleEditSubmit = async (messageId: string, text: string, images?: string[]) => {
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
          body: JSON.stringify({
            content: text,
            ...(images !== undefined ? { images } : {}),
            pruneFollowing: true,
          }),
        }
      );

      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === messageId);
        if (index === -1) return prev;
        const next = [...prev.slice(0, index + 1)];
        next[index] = {
          ...next[index],
          content: text,
          ...(images !== undefined ? { images: [...images] } : {}),
          status: "COMPLETE",
        };
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
        think: readThinkingArmed(),
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
                error: err?.message || "Streaming failed",
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

    // Stored rows carry "provider:model" (e.g. "codecraft:gpt-x"); the chat
    // path needs the plain provider id — strip defensively so a stored id
    // echoed back never becomes "codecraft:codecraft:xxx" (provider 404).
    const activeByokForRegen = getActiveByok();
    const plainModel = activeByokForRegen
      ? stripProviderPrefix(activeByokForRegen.provider, newModel)
      : newModel;

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
        model: plainModel,
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
        selectedModel: plainModel,
        webSearch: readWebSearchArmed(),
        think: readThinkingArmed(),
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
                error: err?.message || "Regeneration failed",
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

  // Resend a USER message to the SAME model that answered it (its following
  // assistant row's model, else the composer's current model). Same-model
  // retry, not a model switch — the RegenerateMenu stays the place for that.
  const handleResend = async (userMessageId: string) => {
    if (!conversationId) return;
    const thread = messagesRef.current;
    const index = thread.findIndex((m) => m.id === userMessageId);
    if (index === -1) return;
    const userMessage = thread[index];
    if (userMessage.role !== "USER") return;

    const next = thread[index + 1];
    const answeredModel =
      next && next.role === "ASSISTANT" && next.model ? next.model : null;
    let sameModel = answeredModel || model;
    // BYOK turns persist "provider:model"; the chat path needs the plain
    // provider model id (never touch ":free" suffixed OpenRouter ids).
    const activeByok = getActiveByok();
    if (activeByok) {
      sameModel = stripProviderPrefix(activeByok.provider, sameModel);
    }

    // Normal case: an answer row follows — reuse it in place, exactly like
    // a regenerate pinned to the same model.
    if (next && next.role === "ASSISTANT") {
      await handleRegenerate(next.id, sameModel);
      return;
    }

    // No answer row yet (previous attempt died before one was saved):
    // append a fresh assistant slot and stream this message again.
    const fallbackModel = resolveModelForPrompt
      ? resolveModelForPrompt(userMessage.content)
      : model;
    setStreaming(true);
    const tempAssistantId = `local-assistant-${Date.now()}`;
    setActiveStreamId(tempAssistantId);
    setActiveTurnKind(detectTurnKind(userMessage.content));
    setMessages((prev) => [
      ...prev,
      {
        id: tempAssistantId,
        role: "ASSISTANT",
        content: "",
        status: "STREAMING",
        model: fallbackModel === "default" ? "default" : fallbackModel,
      },
    ]);
    try {
      await streamAssistant(setMessages, {
        tempAssistantId,
        conversationId,
        existingUserMessageId: userMessage.id,
        selectedModel: fallbackModel,
        webSearch: readWebSearchArmed(),
        think: readThinkingArmed(),
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
                content: err?.message || "Resend failed",
                error: err?.message || "Resend failed",
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

  return {
    messages,
    setMessages,
    lastUserMessage,
    composerError,
    setComposerError,
    messageData,
    // Two-step: only show skeleton when there is NOTHING cached to paint.
    // Cached thread => loading=false, DB fills silently in the background.
    // Shell (sidebar + composer) is always interactive regardless.
    messagesLoading: !!conversationId && messagesPending && messages.length === 0,
    activeTurnKind,
    setActiveTurnKind,
    sendMessage,
    handleEditSubmit,
    handleRegenerate,
    handleResend,
  };
};

export type ChatMessagesApi = ReturnType<typeof useChatMessages>;
