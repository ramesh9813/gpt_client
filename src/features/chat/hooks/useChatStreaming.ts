import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { apiFetch, getCsrfToken, getInMemoryAccessToken, refreshSessionNow, type ApiResponse } from "../../../lib/api";
import {
  getActiveByok,
  getByokHeaders,
  getByokHeadersFor,
  getByokProvider,
} from "../../../lib/byok";
import {
  isDirectSupported,
  streamDirectCompletion,
} from "../../../lib/directByok";
import type { ChatMessage } from "../MessageList";
import { clampWps, readStreamWps } from "../streamSpeed";
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
  files?: Array<{ name: string; mime: string; size: number; content: string }>;
  existingUserMessageId?: string;
  selectedModel?: string;
  research?: boolean;
  artifact?: boolean;
  webSearch?: boolean;
  think?: boolean;
  compactHistory?: boolean;
  promptOnly?: boolean;
  // One-turn media routing (photo/video analysis cards): this provider+key
  // serves the turn while the chat model stays untouched.
  byokOverride?: { provider: string; model: string };
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
      files,
      existingUserMessageId,
      selectedModel,
      research,
      artifact,
      webSearch,
      think,
      compactHistory,
      promptOnly,
      byokOverride,
    }: StreamAssistantArgs
  ) => {
    cancelRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isCancelled = () => controller.signal.aborted || cancelRef.current;

    const ctx: StreamEventCtx = { setMessages, tempAssistantId, isCancelled };

    // Shared WPS typewriter: EVERY token painted on screen — relayed SSE
    // tokens AND browser-direct fallback tokens — flows through this pacer,
    // so Settings → Response streaming speed applies to every model and
    // every provider (OpenRouter, CleanAPIs, custom/unadded providers) with
    // no instant-dump path. Declared before tryDirectFallback because the
    // fallback runs inside the SSE loop below and must reuse it.
    let pendingText = "";
    let streamDone = false;
    let rafId: number | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let resolveFlushDone: (() => void) | null = null;
    let lastFlushAt = 0;

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

    // Human typing — word-by-word at configurable WPS.
    // 5 chars ≈ 1 word. User controls WPS in Settings; default
    // 35 WPS = ~175 CPS. Live WPS is re-read each frame so the slider
    // applies mid-stream, on any provider.
    const FRAME_MS = 16;
    const CHARS_PER_WORD = 5;

    const flushPending = () => {
      flushTimer = null;
      rafId = null;
      if (isCancelled()) {
        pendingText = "";
        resolveOnce();
        return;
      }
      if (pendingText.length === 0) {
        if (streamDone) resolveOnce();
        return;
      }
      // Re-read live so a Settings change mid-stream takes effect instantly
      const liveWps = clampWps(readStreamWps());
      const liveCps = liveWps * CHARS_PER_WORD;
      const charsPerFrame = Math.max(1, Math.round((liveCps * FRAME_MS) / 1000));
      lastFlushAt = performance.now();

      // Final remainder when stream finished: drain at WPS pace for
      // smooth finish — same as live typing, no instant dump.
      // Normal live pace: emit exactly charsPerFrame per frame,
      // word-boundary when possible, newline included naturally.
      const budget = charsPerFrame;
      // Small remainder: flush it to avoid one-char straggler frames
      if (pendingText.length <= budget) {
        const chunk = pendingText;
        pendingText = "";
        appendChunk(chunk);
        if (streamDone) resolveOnce();
        else if (pendingText.length > 0) scheduleFlush();
        return;
      }
      // Find natural break (space or newline) within budget for
      // line-by-line feel without mid-word cuts
      const spaceCut = pendingText.lastIndexOf(" ", budget);
      const nlCut = pendingText.lastIndexOf("\n", budget);
      const breakCut = Math.max(spaceCut, nlCut);
      const at = breakCut > 3 ? breakCut + 1 : budget;
      const chunk = pendingText.slice(0, at);
      pendingText = pendingText.slice(at);
      appendChunk(chunk);
      scheduleFlush();
    };

    const scheduleFlush = () => {
      if (isCancelled()) return;
      if (rafId != null || flushTimer != null) return;
      // Prefer RAF for silk 60fps; fallback to 16ms timer outside browser frame
      if (typeof requestAnimationFrame === "function") {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          flushPending();
        });
      } else {
        flushTimer = setTimeout(flushPending, FRAME_MS);
      }
    };

    const startFlush = () => {
      if (isCancelled()) return;
      scheduleFlush();
    };

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
        // Media-card overrides ride along so the retry stays on that model.
        const overrideHeaders =
          byokOverride && byokOverride.provider && byokOverride.model
            ? getByokHeadersFor(byokOverride.provider, byokOverride.model)
            : {};
        const byokHeaders =
          Object.keys(overrideHeaders).length > 0
            ? overrideHeaders
            : getByokHeaders(selectedModel);
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
            ...(compactHistory ? { compactHistory: true } : {}),
            ...(promptOnly ? { promptOnly: true } : {}),
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
        // Tokens flow through the SAME WPS typewriter as relayed turns, so
        // the Response-streaming speed applies here too (any provider,
        // including custom ones). Drop any undisplayed relay remainder
        // first — the fallback replays the whole turn from scratch.
        pendingText = "";
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
            pendingText += delta;
            startFlush();
          },
        });
        if (result.cancelled || isCancelled()) return true;

        // Drain at WPS pace before persisting, same as the relayed finish.
        streamDone = true;
        if (pendingText.length > 0) {
          startFlush();
        }
        await new Promise<void>((resolve) => {
          resolveFlushDone = resolve;
          if (pendingText.length === 0 && !flushTimer && rafId == null) {
            resolveOnce();
          }
        });

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
      // the OpenRouter body field. A media-card override (photo/video
      // analysis) wins for its turn so the chat model stays untouched.
      const overrideHeaders =
        byokOverride && byokOverride.provider && byokOverride.model
          ? getByokHeadersFor(byokOverride.provider, byokOverride.model)
          : {};
      const byokHeaders =
        Object.keys(overrideHeaders).length > 0
          ? overrideHeaders
          : getByokHeaders(selectedModel);
      const byokActive = Object.keys(byokHeaders).length > 0;
      const streamBody = JSON.stringify({
        conversationId,
        userMessage,
        ...(images && images.length > 0 ? { images } : {}),
        ...(files && files.length > 0 ? { files } : {}),
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
        ...(compactHistory ? { compactHistory: true } : {}),
        ...(promptOnly ? { promptOnly: true } : {}),
      });
      // Auth rides the httpOnly cookie, plus the in-memory bearer as a
      // fallback (the cookie is gone after 15 min idle while JS memory
      // survives — without this the server sees "Missing access token").
      const buildStreamHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
          ...byokHeaders,
        };
        const bearer = getInMemoryAccessToken();
        if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
        return headers;
      };
      const postStream = () =>
        fetch(`${apiBase}/api/chat/stream`, {
          method: "POST",
          headers: buildStreamHeaders(),
          credentials: "include",
          body: streamBody,
          signal: controller.signal,
        });
      let response = await postStream();
      if (response.status === 401 && !isCancelled()) {
        // Session expired while away — refresh silently and retry once, so
        // returning users never see "Missing/Invalid access token".
        const refreshed = await refreshSessionNow().catch(() => false);
        if (refreshed && !isCancelled()) {
          response = await postStream();
        }
      }

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
              if (rafId != null) {
                cancelAnimationFrame(rafId);
                rafId = null;
              }
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
        if (pendingText.length === 0 && !flushTimer && rafId == null) {
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
    // Fully interrupted: clear EVERY streaming row, not just the active id.
    // A background refetch can swap temp ids for real ones mid-stream, which
    // would orphan the stop target and leave three-dot animations forever.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === activeStreamId || m.status === "STREAMING"
          ? { ...m, status: "COMPLETE" }
          : m
      )
    );
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
