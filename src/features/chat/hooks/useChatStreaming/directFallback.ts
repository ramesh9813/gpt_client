import { apiFetch, getCsrfToken, type ApiResponse } from "../../../../lib/api";
import { getActiveByok, getByokHeaders, getByokProvider } from "../../../../lib/byok";
import { isDirectSupported, streamDirectCompletion } from "../../../../lib/directByok";
import type { MessagesSetter } from "./types";

export const createDirectFallback = (
  opts: {
    conversationId: string;
    existingUserMessageId?: string;
    selectedModel?: string;
    artifact?: boolean;
    think?: boolean;
    tempAssistantId: string;
    controller: AbortController;
    isCancelled: () => boolean;
    setMessages: MessagesSetter;
  }
) => async (errPayload: any): Promise<boolean> => {
  let preparedAssistantId: string | null = null;
  try {
    const failedAssistantId = typeof errPayload?.assistantMessageId === "string" ? errPayload.assistantMessageId : null;
    const failedUserId =
      typeof errPayload?.userMessageId === "string" ? errPayload.userMessageId
        : typeof opts.existingUserMessageId === "string" ? opts.existingUserMessageId : null;
    if (!failedAssistantId || !failedUserId) return false;
    const cfg = getActiveByok(); if (!cfg) return false;
    const provider = getByokProvider(cfg.provider);
    if (!provider || !isDirectSupported(cfg.provider)) return false;

    const byokHeaders = getByokHeaders(opts.selectedModel);
    const prep = await apiFetch<ApiResponse<{ assistantMessageId: string; conversationId: string; messages: Array<{ role: string; content: unknown }>; model: string; provider: string; baseUrl: string }>>(
      "/api/chat/direct-prepare",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken(), ...byokHeaders },
        credentials: "include",
        body: JSON.stringify({ conversationId: opts.conversationId, assistantMessageId: failedAssistantId, existingUserMessageId: failedUserId, ...(opts.artifact ? { artifact: true } : {}) }),
      }
    );
    const turn = prep?.data;
    if (!turn || !Array.isArray(turn.messages) || !turn.assistantMessageId || !turn.model || !turn.baseUrl) return false;
    preparedAssistantId = turn.assistantMessageId;

    const startedAt = Date.now();
    const result = await streamDirectCompletion({
      baseUrl: turn.baseUrl, providerName: provider.name, apiKey: cfg.apiKey, model: turn.model, messages: turn.messages,
      // Groq cuts responses short without an explicit ceiling (server relay
      // sends 4096/8192/16000 the same way).
      ...(cfg.provider === "groq" ? { maxTokens: opts.artifact ? 16000 : opts.think ? 8192 : 4096 } : {}),
      signal: opts.controller.signal, isCancelled: opts.isCancelled,
      onToken: (delta) => {
        if (opts.isCancelled()) return;
        opts.setMessages((prev) => prev.map((m) => m.id === opts.tempAssistantId ? { ...m, content: m.content + delta } : m));
      },
    });
    if (result.cancelled || opts.isCancelled()) return true;

    await apiFetch("/api/chat/direct-finish", {
      method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() }, credentials: "include",
      body: JSON.stringify({
        conversationId: opts.conversationId, assistantMessageId: turn.assistantMessageId, content: result.content,
        ...(result.reasoning && opts.think ? { reasoning: result.reasoning } : {}),
        model: `${turn.provider}:${turn.model}`,
        ...(typeof result.usage?.prompt_tokens === "number" ? { promptTokens: result.usage.prompt_tokens } : {}),
        ...(typeof result.usage?.completion_tokens === "number" ? { completionTokens: result.usage.completion_tokens } : {}),
        ...(typeof result.usage?.total_tokens === "number" ? { tokenCount: result.usage.total_tokens } : {}),
        durationMs: Date.now() - startedAt,
      }),
    });
    if (!opts.isCancelled()) {
      const finishedAt = Date.now();
      opts.setMessages((prev) => prev.map((m) => m.id === opts.tempAssistantId ? { ...m, status: "COMPLETE", model: `${turn.provider}:${turn.model}`, durationMs: finishedAt - startedAt } : m));
    }
    return true;
  } catch (err: any) {
    const partial = typeof err?.partialContent === "string" ? err.partialContent : "";
    const reason = (typeof err?.message === "string" && err.message) || "Direct streaming failed";
    if (!preparedAssistantId) return false;
    try {
      await apiFetch("/api/chat/direct-finish", {
        method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() }, credentials: "include",
        body: JSON.stringify({ conversationId: opts.conversationId, assistantMessageId: preparedAssistantId, content: partial, error: reason.slice(0, 2000) }),
      });
    } catch {}
    if (!opts.isCancelled()) opts.setMessages((prev) => prev.map((m) => m.id === opts.tempAssistantId ? { ...m, content: partial, error: reason, status: "ERROR" } : m));
    return true;
  }
};
