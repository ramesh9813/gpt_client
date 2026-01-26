import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import ConversationSidebar from "../features/chat/ConversationSidebar";
import MessageList, { ChatMessage } from "../features/chat/MessageList";
import Composer from "../features/chat/Composer";
import { apiFetch, ApiResponse, getCsrfToken } from "../lib/api";

const Chat = () => {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState("default");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "cheapest" | "free">("name");
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const apiBase = import.meta.env.VITE_API_URL || "";
  const [composerError, setComposerError] = useState<string | null>(null);
  const messageSchema = useMemo(
    () => z.string().min(1, "Message is required").max(8000, "Message too long"),
    []
  );
  type OpenRouterModel = { 
    id: string; 
    name?: string;
    pricing?: { prompt: string; completion: string };
  };

  const { data: messageData } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      apiFetch<ApiResponse<{ messages: ChatMessage[] }>>(
        `/api/conversations/${conversationId}/messages`
      ),
    enabled: !!conversationId
  });

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () =>
      apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>("/api/models"),
    staleTime: 1000 * 60 * 5,
    retry: 1
  });

  useEffect(() => {
    if (messageData?.data?.messages) {
      setMessages(messageData.data.messages);
    }
  }, [messageData, conversationId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      composerInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const streamAssistant = async ({
    tempAssistantId,
    conversationId,
    userMessage,
    existingUserMessageId
  }: {
    tempAssistantId: string;
    conversationId: string;
    userMessage?: string;
    existingUserMessageId?: string;
  }) => {
    const response = await fetch(`${apiBase}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrfToken()
      },
      credentials: "include",
      body: JSON.stringify({
        conversationId,
        userMessage,
        existingUserMessageId,
        model: model === "default" ? undefined : model
      })
    });

    if (!response.ok || !response.body) {
      throw new Error("Streaming failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = "message";
          continue;
        }
        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.replace("event:", "").trim();
          continue;
        }
        if (trimmed.startsWith("data:")) {
          const payload = trimmed.replace("data:", "").trim();
          if (!payload) continue;
          const parsed = JSON.parse(payload);
          if (currentEvent === "token") {
            const delta = parsed.delta as string;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
          }
          if (currentEvent === "error") {
            const errorMessage = (parsed as any).message || "Streaming failed";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: errorMessage, status: "ERROR" }
                  : m
              )
            );
          }
        }
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!conversationId) return;
    const validation = messageSchema.safeParse(text);
    if (!validation.success) {
      setComposerError(validation.error.errors[0]?.message || "Invalid message");
      return;
    }
    setComposerError(null);
    setLastUserMessage(text);
    const tempUserId = `local-user-${Date.now()}`;
    const tempAssistantId = `local-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "USER", content: text },
      {
        id: tempAssistantId,
        role: "ASSISTANT",
        content: "",
        status: "STREAMING",
        model: model === "default" ? "default" : model
      }
    ]);
    setStreaming(true);

    try {
      await streamAssistant({
        tempAssistantId,
        conversationId,
        userMessage: text
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? { ...m, content: "Streaming failed", status: "ERROR" }
            : m
        )
      );
    } finally {
      setStreaming(false);
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

    try {
      await apiFetch<ApiResponse<{ message: ChatMessage }>>(
        `/api/conversations/${conversationId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, pruneFollowing: true })
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
          model: model === "default" ? "default" : model
        });
        return next;
      });

      await streamAssistant({
        tempAssistantId,
        conversationId,
        existingUserMessageId: messageId
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantId
            ? { ...m, content: "Streaming failed", status: "ERROR" }
            : m
        )
      );
      throw new Error("Streaming failed");
    } finally {
      setStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const handleRegenerate = async (messageId: string, newModel: string) => {
    if (!conversationId) return;
    
    // Find the user message preceding this assistant message
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex <= 0) return; // Should have a user message before it
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== "USER") return;

    setStreaming(true);
    setModel(newModel); // Optionally update the global model state

    // Optimistically update the UI to show loading state for the assistant message
    setMessages((prev) => {
      const next = [...prev];
      next[messageIndex] = {
        ...next[messageIndex],
        content: "", // Clear content to show spinner/loading
        status: "STREAMING",
        model: newModel
      };
      return next;
    });

    try {
      // Use the existing user message ID to regenerate response
      await streamAssistant({
        tempAssistantId: messageId, // Reuse the same ID or generate a new one if we wanted to append. 
                                    // Reusing replaces the message content in-place which is what "Regenerate" usually implies here.
        conversationId,
        existingUserMessageId: userMessage.id
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: "Regeneration failed", status: "ERROR" }
            : m
        )
      );
    } finally {
      setStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  };

  const fallbackModelOptions = useMemo(
    () => [
      { label: "OpenAI GPT-4o mini", value: "openai/gpt-4o-mini" },
      { label: "Anthropic Claude 3 Haiku", value: "anthropic/claude-3-haiku" }
    ],
    []
  );

  const dynamicModelOptions = useMemo(() => {
    const models = modelsData?.data?.models ?? [];
    const sorted = [...models].sort((a, b) => {
      if (sortBy === "name") {
        const left = a.name || a.id;
        const right = b.name || b.id;
        return left.localeCompare(right);
      }
      if (sortBy === "cheapest") {
        const priceA = parseFloat(a.pricing?.prompt || "0") + parseFloat(a.pricing?.completion || "0");
        const priceB = parseFloat(b.pricing?.prompt || "0") + parseFloat(b.pricing?.completion || "0");
        return priceA - priceB;
      }
      if (sortBy === "free") {
        const isFreeA = (parseFloat(a.pricing?.prompt || "0") + parseFloat(a.pricing?.completion || "0")) === 0;
        const isFreeB = (parseFloat(b.pricing?.prompt || "0") + parseFloat(b.pricing?.completion || "0")) === 0;
        if (isFreeA && !isFreeB) return -1;
        if (!isFreeA && isFreeB) return 1;
        const left = a.name || a.id;
        const right = b.name || b.id;
        return left.localeCompare(right);
      }
      return 0;
    });
    const seen = new Set<string>();

    return sorted
      .filter((model) => {
        if (!model?.id) return false;
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      })
      .map((model) => {
        let name = model.name || model.id;
        if (name.includes(": ")) {
          name = name.split(": ").slice(1).join(": ");
        } else if (name.includes(":")) {
          name = name.split(":").slice(1).join(":");
        }
        return {
          label: name.trim(),
          value: model.id
        };
      });
  }, [modelsData?.data?.models, sortBy]);

  const modelOptions = useMemo(() => {
    const options =
      dynamicModelOptions.length > 0 ? dynamicModelOptions : fallbackModelOptions;
    return [{ label: "Default model", value: "default" }, ...options];
  }, [dynamicModelOptions, fallbackModelOptions]);

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      <ConversationSidebar />
      <main className="flex flex-1 flex-col">
        <MessageList
          messages={messages}
          onEditSubmit={handleEditSubmit}
          editDisabled={streaming}
          modelOptions={modelOptions}
          onRegenerate={handleRegenerate}
        />
        <Composer
          onSend={sendMessage}
          disabled={streaming}
          error={composerError}
          lastUserMessage={lastUserMessage}
          model={model}
          modelOptions={modelOptions}
          onModelChange={setModel}
          inputRef={composerInputRef}
          sort={sortBy}
          onSortChange={setSortBy}
        />
      </main>
    </div>
  );
};

export default Chat;

