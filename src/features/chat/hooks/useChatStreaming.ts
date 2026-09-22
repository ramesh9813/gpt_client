import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getCsrfToken } from "../../../lib/api";
import type { ChatMessage } from "../MessageList";
import {
  applyFollowupsEvent,
  applyImagesEvent,
  applyQuizEvent,
  applyReasoningEvent,
  applyVideosEvent,
  type StreamEventCtx,
} from "./streamEvents";

export type MessagesSetter = Dispatch<SetStateAction<ChatMessage[]>>;

export type StreamAssistantArgs = {
  tempAssistantId: string;
  conversationId: string;
  userMessage?: string;
  images?: string[];
  existingUserMessageId?: string;
  selectedModel?: string;
  research?: boolean;
  artifact?: boolean;
  webSearch?: boolean;
};

export const useChatStreaming = () => {
  const [streaming, setStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
  const apiBase = import.meta.env.VITE_API_URL || "";

  const streamAssistant = async (
    setMessages: MessagesSetter,
    {
      tempAssistantId,
      conversationId,
      userMessage,
      images,
      existingUserMessageId,
      selectedModel,
      research,
      artifact,
      webSearch,
    }: StreamAssistantArgs
  ) => {
    cancelRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isCancelled = () => controller.signal.aborted || cancelRef.current;

    const ctx: StreamEventCtx = { setMessages, tempAssistantId, isCancelled };

    try {
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        credentials: "include",
        body: JSON.stringify({
          conversationId,
          userMessage,
          ...(images && images.length > 0 ? { images } : {}),
          existingUserMessageId,
          model:
            selectedModel && selectedModel !== "default"
              ? selectedModel
              : undefined,
          ...(research ? { research: true } : {}),
          ...(artifact ? { artifact: true } : {}),
          // Always explicit: an explicit OFF must beat the default-ON.
          ...(webSearch === undefined ? {} : { webSearch }),
        }),
        signal: controller.signal,
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
        // Frame-paced typewriter (~20fps): big enough chunks to stay lively,
        // slow enough that React + layout + paint breathe between frames on
        // low-end devices instead of re-rendering every few milliseconds.
        const chunkSize = Math.max(
          120,
          Math.min(480, Math.ceil(pendingText.length / 6))
        );
        const chunk = pendingText.slice(0, chunkSize);
        pendingText = pendingText.slice(chunkSize);
        appendChunk(chunk);
        flushTimer = setTimeout(flushPending, 50);
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
            if (currentEvent === "reasoning") {
              if (applyReasoningEvent(ctx, parsed)) return;
            }
            if (currentEvent === "followups") {
              if (applyFollowupsEvent(ctx, parsed)) return;
            }
            if (currentEvent === "quiz") {
              if (applyQuizEvent(ctx, parsed)) return;
            }
            if (currentEvent === "images") {
              if (applyImagesEvent(ctx, parsed)) return;
            }
            if (currentEvent === "videos") {
              if (applyVideosEvent(ctx, parsed)) return;
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

  const stopStreaming = (setMessages: MessagesSetter) => {
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

  return {
    streaming,
    setStreaming,
    activeStreamId,
    setActiveStreamId,
    cancelRef,
    abortControllerRef,
    streamAssistant,
    stopStreaming,
  };
};

export type ChatStreamingApi = ReturnType<typeof useChatStreaming>;
