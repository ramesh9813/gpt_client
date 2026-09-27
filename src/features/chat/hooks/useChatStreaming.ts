import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { apiFetch, getCsrfToken, type ApiResponse } from "../../../lib/api";
import {
  getActiveByok,
  getByokHeaders,
  getByokProvider,
} from "../../../lib/byok";
import {
  isDirectSupported,
  streamDirectCompletion,
} from "../../../lib/directByok";
import type { ChatMessage } from "../MessageList";
import {
  applyFollowupsEvent,
  applyImagesEvent,
  applyNoticeEvent,
  applyQuizEvent,
  applyReasoningEvent,
  applySourcesEvent,
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
  think?: boolean;
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
      think,
    }: StreamAssistantArgs
  ) => {
    cancelRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isCancelled = () => controller.signal.aborted || cancelRef.current;

    const ctx: StreamEventCtx = { setMessages, tempAssistantId, isCancelled };

    // Browser-direct fallback: when the SERVER relay is firewalled
    // (challenged SSE error), replay the exact prepared turn straight from
    // the browser with the user's own Settings key, then persist it via
    // /api/chat/direct-finish. Returns true when the turn was recovered
    // (fully or as a persisted partial with its real reason).
    const tryDirectFallback = async (errPayload: any): Promise<boolean> => {
      // Real server row for the failed turn — needed to persist any outcome
      // so the row can never be stranded as eternal STREAMING.
      let preparedAssistantId: string | null = null;
      try {
        const failedAssistantId =
          typeof errPayload?.assistantMessageId === "string"
            ? errPayload.assistantMessageId
            : null;
        const failedUserId =
          typeof errPayload?.userMessageId === "string"
            ? errPayload.userMessageId
            : typeof existingUserMessageId === "string"
              ? existingUserMessageId
              : null;
        if (!failedAssistantId || !failedUserId) return false;
        const cfg = getActiveByok();
        if (!cfg) return false;
        const provider = getByokProvider(cfg.provider);
        if (!provider || !isDirectSupported(cfg.provider)) return false;

        // 1. Server prepares the exact turn payload + resets the failed row.
        // The key travels in x-byok-* headers as on every turn; the server
        // verifies ownership but never needs to call the provider itself.
        const byokHeaders = getByokHeaders(selectedModel);
        const prep = await apiFetch<
          ApiResponse<{
            assistantMessageId: string;
            conversationId: string;
            messages: Array<{ role: string; content: unknown }>;
            model: string;
            provider: string;
            baseUrl: string;
          }>
        >("/api/chat/direct-prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
            ...byokHeaders,
          },
          credentials: "include",
          body: JSON.stringify({
            conversationId,
            assistantMessageId: failedAssistantId,
            existingUserMessageId: failedUserId,
            ...(artifact ? { artifact: true } : {}),
          }),
        });
        const turn = prep?.data;
        if (
          !turn ||
          !Array.isArray(turn.messages) ||
          !turn.assistantMessageId ||
          !turn.model ||
          !turn.baseUrl
        ) {
          return false;
        }
        preparedAssistantId = turn.assistantMessageId;

        // 2. Stream straight from the browser with the user's own key.
        const startedAt = Date.now();
        const result = await streamDirectCompletion({
          baseUrl: turn.baseUrl,
          providerName: provider.name,
          apiKey: cfg.apiKey,
          model: turn.model,
          messages: turn.messages,
          signal: controller.signal,
          isCancelled,
          onToken: (delta) => {
            if (isCancelled()) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
          },
        });
        if (result.cancelled || isCancelled()) return true;

        // 3. Persist onto the prepared row (server ownership-checks it).
        await apiFetch("/api/chat/direct-finish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
          body: JSON.stringify({
            conversationId,
            assistantMessageId: turn.assistantMessageId,
            content: result.content,
            // Same contract as the relay: thinking traces persist only when
            // the user armed think mode.
            ...(result.reasoning && think ? { reasoning: result.reasoning } : {}),
            model: `${turn.provider}:${turn.model}`,
            ...(typeof result.usage?.prompt_tokens === "number"
              ? { promptTokens: result.usage.prompt_tokens }
              : {}),
            ...(typeof result.usage?.completion_tokens === "number"
              ? { completionTokens: result.usage.completion_tokens }
              : {}),
            ...(typeof result.usage?.total_tokens === "number"
              ? { tokenCount: result.usage.total_tokens }
              : {}),
            durationMs: Date.now() - startedAt,
          }),
        });
        if (!isCancelled()) {
          const finishedAt = Date.now();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? {
                    ...m,
                    status: "COMPLETE",
                    model: `${turn.provider}:${turn.model}`,
                    durationMs: finishedAt - startedAt,
                  }
                : m
            )
          );
        }
        return true;
      } catch (err: any) {
        // The prepared row was reset to STREAMING — settle it here so it can
        // never strand as eternal typing. Partial answers persist with their
        // REAL direct reason; total failures persist the reason with empty
        // content. No prepared row (prepare itself failed) → let the caller
        // show the original firewall error instead.
        const partial =
          typeof err?.partialContent === "string" ? err.partialContent : "";
        const reason =
          (typeof err?.message === "string" && err.message) ||
          "Direct streaming failed";
        if (!preparedAssistantId) return false;
        try {
          await apiFetch("/api/chat/direct-finish", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": getCsrfToken(),
            },
            credentials: "include",
            body: JSON.stringify({
              conversationId,
              assistantMessageId: preparedAssistantId,
              content: partial,
              error: reason.slice(0, 2000),
            }),
          });
        } catch {
          // best-effort only
        }
        if (!isCancelled()) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantId
                ? { ...m, content: partial, error: reason, status: "ERROR" }
                : m
            )
          );
        }
        return true;
      }
    };

    try {
      // BYOK: user-configured provider key (Settings > AI provider). When
      // active, headers steer the server's chat turn to that provider; the
      // composer's selected (provider) model travels in the header instead of
      // the OpenRouter body field.
      const byokHeaders = getByokHeaders(selectedModel);
      const byokActive = Object.keys(byokHeaders).length > 0;
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
          ...byokHeaders,
        },
        credentials: "include",
        body: JSON.stringify({
          conversationId,
          userMessage,
          ...(images && images.length > 0 ? { images } : {}),
          existingUserMessageId,
          model:
            !byokActive && selectedModel && selectedModel !== "default"
              ? selectedModel
              : undefined,
          ...(research ? { research: true } : {}),
          ...(artifact ? { artifact: true } : {}),
          // Always explicit: an explicit OFF must beat the default-ON.
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

      // Line-by-line typewriter: buffer SSE token deltas and render whole
      // lines per tick so the answer types out line by line (no mid-line
      // markdown reflow). Backlog drains adaptively (~4 ticks) so long
      // answers never feel buffered; a long single line without newlines
      // flushes progressively at word boundaries so output never stalls.
      // Final remainder (no trailing newline) flushes when the stream ends.
      const LINE_TICK_MS = 70;
      const PARTIAL_FLUSH_CHARS = 160;
      const MAX_LINES_PER_TICK = 8;

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
        const lastNl = pendingText.lastIndexOf("\n");
        if (lastNl >= 0) {
          const complete = pendingText.slice(0, lastNl + 1);
          const rest = pendingText.slice(lastNl + 1);
          const completeLines = complete.slice(0, -1).split("\n");
          const totalLines = completeLines.length;
          const perTick = Math.max(
            1,
            Math.min(
              MAX_LINES_PER_TICK,
              Math.ceil(totalLines / 4)
            )
          );
          const emitCount = Math.min(perTick, totalLines);
          const chunk =
            completeLines.slice(0, emitCount).join("\n") + "\n";
          const leftover = completeLines.slice(emitCount);
          pendingText =
            (leftover.length > 0 ? leftover.join("\n") + "\n" : "") + rest;
          appendChunk(chunk);
          if (pendingText.length > 0) {
            flushTimer = setTimeout(flushPending, LINE_TICK_MS);
          } else if (streamDone) {
            resolveOnce();
          }
          // Pending empty + stream live: no timer — next token re-arms
          // via startFlush. Avoids no-op wakeups between batches.
          return;
        }
        // No complete line yet.
        if (streamDone) {
          const chunk = pendingText;
          pendingText = "";
          appendChunk(chunk);
          resolveOnce();
          return;
        }
        if (pendingText.length >= PARTIAL_FLUSH_CHARS) {
          // Long single line: flush up to a word boundary to stay alive.
          const cut = pendingText.lastIndexOf(" ", PARTIAL_FLUSH_CHARS);
          const at = cut > 40 ? cut + 1 : PARTIAL_FLUSH_CHARS;
          const chunk = pendingText.slice(0, at);
          pendingText = pendingText.slice(at);
          appendChunk(chunk);
          flushTimer = setTimeout(flushPending, LINE_TICK_MS);
          return;
        }
        // Short partial line: hold until the line completes, more tokens
        // arrive (startFlush), or the stream ends. No spin timer here.
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
            if (currentEvent === "sources") {
              if (applySourcesEvent(ctx, parsed)) return;
            }
            if (currentEvent === "notice") {
              if (applyNoticeEvent(ctx, parsed)) return;
            }
            if (currentEvent === "error") {
              if (isCancelled()) return;
              // Firewalled relay: retry the exact turn straight from the
              // browser with the user's own key before showing any error.
              if ((parsed as any).challenged === true) {
                try {
                  if (await tryDirectFallback(parsed)) return;
                } catch {
                  // fall through to the error display below
                }
              }
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
                    ? { ...m, content: errorMessage, error: errorMessage, status: "ERROR" }
                    : m
                )
              );
              // Terminal: the server ended the turn. Stop parsing so later
              // chunks can't resurrect content over the error.
              return;
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
