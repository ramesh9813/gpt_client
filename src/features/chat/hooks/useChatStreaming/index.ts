import { useRef, useState } from "react";
import { getCsrfToken } from "../../../../lib/api";
import { getByokHeaders } from "../../../../lib/byok";
import type { MessagesSetter, StreamAssistantArgs } from "./types";
import { createDirectFallback } from "./directFallback";
import { createThrottle, type ThrottleState } from "./typingThrottle";
import {
  applyFollowupsEvent, applyImagesEvent, applyNoticeEvent, applyQuizEvent, applyReasoningEvent, applySourcesEvent, applyStageEvent, applyVideosEvent, type StreamEventCtx,
} from "../streamEvents";

export type { MessagesSetter, StreamAssistantArgs } from "./types";

export const useChatStreaming = () => {
  const [streaming, setStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
  const apiBase = import.meta.env.VITE_API_URL || "";

  const streamAssistant = async (
    setMessages: MessagesSetter,
    { tempAssistantId, conversationId, userMessage, images, files, existingUserMessageId, selectedModel, research, artifact, webSearch, think }: StreamAssistantArgs
  ) => {
    cancelRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const isCancelled = () => controller.signal.aborted || cancelRef.current;
    const ctx: StreamEventCtx = { setMessages, tempAssistantId, isCancelled };

    try {
      const byokHeaders = getByokHeaders(selectedModel);
      const byokActive = Object.keys(byokHeaders).length > 0;
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken(), ...byokHeaders },
        credentials: "include",
        body: JSON.stringify({
          conversationId, userMessage,
          ...(images && images.length > 0 ? { images } : {}),
          ...(files && files.length > 0 ? { files } : {}),
          existingUserMessageId,
          model: !byokActive && selectedModel && selectedModel !== "default" ? selectedModel : undefined,
          ...(research ? { research: true } : {}),
          ...(artifact ? { artifact: true } : {}),
          ...(webSearch === undefined ? {} : { webSearch }),
          ...(think ? { think: true } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        let message = "Streaming failed";
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error?.message || parsed?.message || text || response.statusText || message;
        } catch { message = text || response.statusText || message; }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      const throttleState: ThrottleState = { pendingText: "", streamDone: false, rafId: null, flushTimer: null, resolveFlushDone: null };
      const appendChunk = (chunk: string) => {
        if (isCancelled()) return;
        setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, content: m.content + chunk } : m));
      };
      const throttle = createThrottle(throttleState, isCancelled, appendChunk);
      const tryDirectFallback = createDirectFallback({ conversationId, existingUserMessageId, selectedModel, artifact, think, tempAssistantId, controller, isCancelled, setMessages });

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try { readResult = await reader.read(); } catch (err) { if (isCancelled()) return; throw err; }
        const { value, done } = readResult;
        if (done) break;
        if (isCancelled()) return;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() || "";
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed) { currentEvent = "message"; continue; }
          if (trimmed.startsWith("event:")) { currentEvent = trimmed.replace("event:", "").trim(); continue; }
          if (trimmed.startsWith("data:")) {
            const payload = trimmed.replace("data:", "").trim();
            if (!payload) continue;
            const parsed = JSON.parse(payload);
            if (currentEvent === "token") {
              const delta = parsed.delta as string;
              throttleState.pendingText += delta;
              // First token paints synchronously for minimal perceived TTFB.
              if (!throttle.firstTokenFlushed) throttle.flushFirstTokenSync();
              else throttle.startFlush();
            }
            if (currentEvent === "reasoning" && applyReasoningEvent(ctx, parsed)) return;
            if (currentEvent === "followups" && applyFollowupsEvent(ctx, parsed)) return;
            if (currentEvent === "quiz" && applyQuizEvent(ctx, parsed)) return;
            if (currentEvent === "images" && applyImagesEvent(ctx, parsed)) return;
            if (currentEvent === "videos" && applyVideosEvent(ctx, parsed)) return;
            if (currentEvent === "sources" && applySourcesEvent(ctx, parsed)) return;
            if (currentEvent === "notice" && applyNoticeEvent(ctx, parsed)) return;
            if (currentEvent === "stage" && applyStageEvent(ctx, parsed)) return;
            if (currentEvent === "error") {
              if (isCancelled()) return;
              if ((parsed as any).challenged === true) { try { if (await tryDirectFallback(parsed)) return; } catch {} }
              const errorMessage = (parsed as any).message || "Streaming failed";
              throttleState.pendingText = ""; throttleState.streamDone = true;
              if (throttleState.rafId != null) { cancelAnimationFrame(throttleState.rafId); throttleState.rafId = null; }
              if (throttleState.flushTimer) { clearTimeout(throttleState.flushTimer); throttleState.flushTimer = null; }
              setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, content: errorMessage, error: errorMessage, status: "ERROR" } : m));
              return;
            }
          }
        }
      }

      throttleState.streamDone = true;
      if (throttleState.pendingText.length > 0) throttle.startFlush();
      await new Promise<void>((resolve) => {
        throttleState.resolveFlushDone = resolve;
        if (throttleState.pendingText.length === 0 && !throttleState.flushTimer && throttleState.rafId == null) throttle.resolveOnce();
      });
    } catch (err) {
      if (isCancelled()) return;
      throw err;
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const stopStreaming = (setMessages: MessagesSetter) => {
    cancelRef.current = true;
    abortControllerRef.current?.abort();
    setStreaming(false);
    if (activeStreamId) setMessages((prev) => prev.map((m) => m.id === activeStreamId ? { ...m, status: "COMPLETE" } : m));
    setActiveStreamId(null);
  };

  return { streaming, setStreaming, activeStreamId, setActiveStreamId, cancelRef, abortControllerRef, streamAssistant, stopStreaming };
};

export type ChatStreamingApi = ReturnType<typeof useChatStreaming>;
