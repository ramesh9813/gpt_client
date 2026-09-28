// Per-chat Tuning cache — lazy, Cache-First.
// Loads once when a chat is opened / when the Tuning modal opens.
// Persists to localStorage so the next open paints instantly; DB write only on Save.

import { apiFetch, ApiResponse } from "../../lib/api";

export const TUNING_MAX_LENGTH = 2000;

export type TuningConfig = {
  customPrompt: string | null;
  customPromptEnabled: boolean;
};

const keyFor = (conversationId: string) => `chatapp.tuning.${conversationId}`;

function safeRead<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // quota / private mode — ignore
  }
}

export function readCachedTuning(conversationId: string): TuningConfig | null {
  if (!conversationId) return null;
  const cached = safeRead<TuningConfig>(keyFor(conversationId));
  if (!cached || typeof cached !== "object") return null;
  return {
    customPrompt: typeof cached.customPrompt === "string" ? cached.customPrompt : cached.customPrompt == null ? null : String(cached.customPrompt),
    customPromptEnabled: cached.customPromptEnabled === true,
  };
}

export function writeCachedTuning(conversationId: string, cfg: TuningConfig): void {
  if (!conversationId) return;
  safeWrite(keyFor(conversationId), cfg);
}

export function clearCachedTuning(conversationId: string): void {
  try {
    localStorage.removeItem(keyFor(conversationId));
  } catch {
    // ignore
  }
}

export async function fetchTuning(conversationId: string): Promise<TuningConfig> {
  const res = await apiFetch<ApiResponse<{ tuning: { id: string; customPrompt: string | null; customPromptEnabled: boolean } }>>(
    `/api/conversations/${conversationId}/tuning`
  );
  const t = res.data?.tuning;
  const cfg: TuningConfig = {
    customPrompt: t?.customPrompt ?? null,
    customPromptEnabled: t?.customPromptEnabled === true,
  };
  writeCachedTuning(conversationId, cfg);
  return cfg;
}

export async function saveTuning(conversationId: string, cfg: TuningConfig): Promise<TuningConfig> {
  const body: Record<string, unknown> = {};
  // Always send both so the server can sanitise atomically
  body.customPrompt = cfg.customPrompt;
  body.customPromptEnabled = cfg.customPromptEnabled;
  const res = await apiFetch<ApiResponse<{ tuning: { id: string; customPrompt: string | null; customPromptEnabled: boolean } }>>(
    `/api/conversations/${conversationId}/tuning`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const t = res.data?.tuning;
  const next: TuningConfig = {
    customPrompt: t?.customPrompt ?? cfg.customPrompt ?? null,
    customPromptEnabled: t?.customPromptEnabled ?? cfg.customPromptEnabled,
  };
  writeCachedTuning(conversationId, next);
  return next;
}
