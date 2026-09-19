import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import ConversationSidebar from "../features/chat/ConversationSidebar";
import MessageList, { ChatMessage } from "../features/chat/MessageList";
import Composer from "../features/chat/Composer";
import { apiFetch, ApiResponse, getCsrfToken } from "../lib/api";
import CanvasPanel from "../features/chat/CanvasPanel";
import { buildCanvasData } from "../features/chat/canvas";
import { useMe } from "../lib/hooks";

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [model, setModel] = useState("default");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "cheapest" | "free">("name");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
  const apiBase = import.meta.env.VITE_API_URL || "";
  const [composerError, setComposerError] = useState<string | null>(null);
  const { data: meData } = useMe();
  const currentRole = meData?.data?.user?.role;
  const isFreeRole = currentRole === "user";
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

  const { data: convsData } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Array<{ id: string; title: string }> }>>(
        "/api/conversations"
      )
  });

  const currentConv = convsData?.data?.items?.find((c) => c.id === conversationId);
  const currentConversationTitle = currentConv?.title;

  const handleNewChat = async () => {
    try {
      const res = await apiFetch<ApiResponse<{ conversation: { id: string } }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${res.data.conversation.id}`);
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch {
      navigate("/");
    }
  };

  useEffect(() => {
    if (messageData?.data?.messages) {
      setMessages(messageData.data.messages);
    }
  }, [messageData, conversationId]);

  const canvasData = useMemo(() => buildCanvasData(messages), [messages]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasDismissed, setCanvasDismissed] = useState(false);

  useEffect(() => {
    if (canvasData.blocks.length === 0) {
      setShowCanvas(false);
      setCanvasDismissed(false);
      return;
    }
    if (!canvasDismissed) {
      setShowCanvas(true);
    }
  }, [canvasData.blocks.length, canvasDismissed]);

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

  // Horizontal swipe gesture to open/close history sidebar on touch devices (Android & mobile)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        // Don't trigger if user is interacting with an input, textarea, or editable element
        if (target.closest("textarea, input, [contenteditable='true']")) {
          touchStartX = 0;
          return;
        }
        // Don't trigger if swiping inside a horizontally scrollable code block or pre element
        const scrollable = target.closest("pre, code, .overflow-x-auto");
        if (scrollable && scrollable.scrollWidth > scrollable.clientWidth) {
          touchStartX = 0;
          return;
        }
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;
      touchStartX = 0;

      // Quick gesture within 600ms
      if (deltaTime > 600) return;

      // Ensure horizontal swipe is dominant (horizontal delta > 1.3x vertical delta) and at least 45px
      if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        if (deltaX > 0 && !sidebarOpen) {
          // Swipe Right -> Open history sidebar
          setSidebarOpen(true);
        } else if (deltaX < 0 && sidebarOpen) {
          // Swipe Left -> Hide history sidebar
          setSidebarOpen(false);
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [sidebarOpen]);

  const streamAssistant = async ({
    tempAssistantId,
    conversationId,
    userMessage,
    existingUserMessageId,
    selectedModel
  }: {
    tempAssistantId: string;
    conversationId: string;
    userMessage?: string;
    existingUserMessageId?: string;
    selectedModel?: string;
  }) => {
    cancelRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isCancelled = () => controller.signal.aborted || cancelRef.current;

    try {
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
          model:
            selectedModel && selectedModel !== "default"
              ? selectedModel
              : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        let message = "Streaming failed";
        try {
          const parsed = JSON.parse(text);
          message =
            parsed?.error?.message ||
            parsed?.message ||
            text ||
            response.statusText ||
            message;
        } catch {
          message = text || response.statusText || message;
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";
      let pendingText = "";
      let streamDone = false;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let resolveFlushDone: (() => void) | null = null;

      const resolveOnce = () => {
        if (!resolveFlushDone) return;
        const resolver = resolveFlushDone;
        resolveFlushDone = null;
        resolver();
      };

      const appendChunk = (chunk: string) => {
        if (isCancelled()) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      const flushPending = () => {
        flushTimer = null;
        if (isCancelled()) {
          pendingText = "";
          resolveOnce();
          return;
        }
        if (pendingText.length === 0) {
          if (streamDone) resolveOnce();
          return;
        }
        const chunkSize = Math.max(
          40,
          Math.min(160, Math.ceil(pendingText.length / 18))
        );
        const chunk = pendingText.slice(0, chunkSize);
        pendingText = pendingText.slice(chunkSize);
        appendChunk(chunk);
        flushTimer = setTimeout(flushPending, 4);
      };

      const startFlush = () => {
        if (flushTimer || isCancelled()) return;
        flushTimer = setTimeout(flushPending, 0);
      };

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (err) {
          if (isCancelled()) return;
          throw err;
        }
        const { value, done } = readResult;
        if (done) break;
        if (isCancelled()) return;
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
              pendingText += delta;
              startFlush();
            }
            if (currentEvent === "error") {
              if (isCancelled()) return;
              const errorMessage = (parsed as any).message || "Streaming failed";
              pendingText = "";
              streamDone = true;
              if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = null;
              }
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

      streamDone = true;
      if (pendingText.length > 0) {
        startFlush();
      }
      await new Promise<void>((resolve) => {
        resolveFlushDone = resolve;
        if (pendingText.length === 0 && !flushTimer) {
          resolveOnce();
        }
      });
    } catch (err) {
      if (isCancelled()) {
        return;
      }
      throw err;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const stopStreaming = () => {
    cancelRef.current = true;
    abortControllerRef.current?.abort();
    setStreaming(false);
    if (activeStreamId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === activeStreamId ? { ...m, status: "COMPLETE" } : m
        )
      );
    }
    setActiveStreamId(null);
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
    setActiveStreamId(tempAssistantId);

    try {
      await streamAssistant({
        tempAssistantId,
        conversationId,
        userMessage: text,
        selectedModel: model
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
                status: "ERROR"
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
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
        existingUserMessageId: messageId,
        selectedModel: model
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
                status: "ERROR"
              }
            : m
        )
      );
      throw new Error(err?.message || "Streaming failed");
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
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
    setActiveStreamId(messageId);

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
        existingUserMessageId: userMessage.id,
        selectedModel: newModel
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
                status: "ERROR"
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setActiveStreamId(null);
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  };

  const fallbackModelOptions = useMemo(
    () =>
      isFreeRole
        ? []
        : [
            { label: "OpenAI GPT-4o mini", value: "openai/gpt-4o-mini" },
            { label: "Anthropic Claude 3 Haiku", value: "anthropic/claude-3-haiku" }
          ],
    [isFreeRole]
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
    return [
      {
        label: isFreeRole ? "Default free model" : "Default model",
        value: "default"
      },
      ...options
    ];
  }, [dynamicModelOptions, fallbackModelOptions, isFreeRole]);

  useEffect(() => {
    if (model === "default") return;
    const allowed = modelOptions.some((option) => option.value === model);
    if (!allowed) {
      setModel("default");
    }
  }, [model, modelOptions]);

  return (
    <div className="flex h-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <ConversationSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />
      <main className="flex flex-1 min-w-0 flex-col h-full overflow-hidden">
        {/* Top Header Bar with small history button */}
        <header className="flex h-12 sm:h-14 items-center justify-between border-b border-[var(--border)] px-3 sm:px-4 bg-[var(--bg)] z-30 pt-[env(safe-area-inset-top,0px)] flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--sidebar)] active:scale-95 transition-all shadow-xs"
                title="Open history"
                aria-label="Open history"
                type="button"
              >
                <i className="bi bi-layout-sidebar-inset text-base"></i>
              </button>
            )}
            <div className="font-semibold text-sm sm:text-base flex items-center gap-1.5 overflow-hidden">
              <span className="text-[var(--text)] flex-shrink-0">ChatGPT</span>
              {currentConversationTitle && (
                <span className="hidden sm:inline-block text-xs text-[var(--muted)] max-w-[240px] truncate font-normal">
                  / {currentConversationTitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canvasData.blocks.length > 0 ? (
              <button
                onClick={() => {
                  if (showCanvas) {
                    setShowCanvas(false);
                    setCanvasDismissed(true);
                  } else {
                    setShowCanvas(true);
                    setCanvasDismissed(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] active:scale-95 transition-all"
                type="button"
              >
                <i className={`bi ${showCanvas ? "bi-layout-sidebar-inset" : "bi-layout-sidebar-inset-reverse"}`}></i>
                <span className="hidden sm:inline">{showCanvas ? "Hide Canvas" : "Show Canvas"}</span>
                <span className="sm:hidden">Canvas</span>
              </button>
            ) : null}
            <button
              onClick={handleNewChat}
              className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--sidebar)] active:scale-95 transition-all shadow-xs"
              title="New chat"
              aria-label="New chat"
              type="button"
            >
              <i className="bi bi-pencil-square text-sm"></i>
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <section className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
            <MessageList
              messages={messages}
              onEditSubmit={handleEditSubmit}
              editDisabled={streaming}
              modelOptions={modelOptions}
              onRegenerate={handleRegenerate}
              onStopStreaming={stopStreaming}
              activeStreamId={activeStreamId}
              contentOverrides={showCanvas ? canvasData.displayMap : undefined}
              hasCanvasCode={showCanvas ? canvasData.hasCodeMap : undefined}
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
              streaming={streaming}
              onStop={stopStreaming}
            />
          </section>
          {showCanvas ? (
            <CanvasPanel
              blocks={canvasData.blocks}
              onClose={() => {
                setShowCanvas(false);
                setCanvasDismissed(true);
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Chat;

