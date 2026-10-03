// Per-chat Tuning cache — lazy, Cache-First.
// Loads once when a chat is opened / when the Tuning modal opens.
// Persists to localStorage so the next open paints instantly; DB write only on Save.

import { apiFetch, ApiResponse } from "../../lib/api";

export const TUNING_MAX_LENGTH = 2000;
export const MAX_TUNING_PROMPTS = 20;

// Todo-list tuning: a chat holds many single-line prompts, each with its own
// on/off switch, instead of one big textarea.
export type TuningPromptItem = {
  id: string;
  text: string;
  enabled: boolean;
};

export type TuningConfig = {
  customPrompt: string | null;
  customPromptEnabled: boolean;
  customPrompts: TuningPromptItem[];
  // Folder prompts muted inside this chat only (folder item ids).
  mutedFolderPromptIds?: string[];
};

export const makeTuningId = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const coerceItem = (raw: unknown): TuningPromptItem | null => {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { id: makeTuningId(), text, enabled: true } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; text?: unknown; enabled?: unknown };
  const text = typeof r.text === "string" ? r.text.trim() : "";
  if (!text) return null;
  return {
    id: typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 64) : makeTuningId(),
    text,
    enabled: r.enabled !== false,
  };
};

// Old caches / legacy rows ({customPrompt} string) become a one-item list.
export const normalizeTuningList = (
  raw: unknown,
  legacyPrompt?: unknown,
  legacyEnabled?: unknown
): TuningPromptItem[] => {
  const items: TuningPromptItem[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (items.length >= MAX_TUNING_PROMPTS) break;
      const item = coerceItem(entry);
      if (item) items.push(item);
    }
  }
  if (items.length === 0 && typeof legacyPrompt === "string" && legacyPrompt.trim()) {
    items.push({ id: makeTuningId(), text: legacyPrompt.trim(), enabled: legacyEnabled !== false });
  }
  return items;
};

export const tuningActiveCount = (
  raw: unknown,
  legacyPrompt?: unknown,
  legacyEnabled?: unknown
): number =>
  normalizeTuningList(raw, legacyPrompt, legacyEnabled).filter((i) => i.enabled).length;

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
  const legacyPrompt =
    typeof cached.customPrompt === "string" ? cached.customPrompt : cached.customPrompt == null ? null : String(cached.customPrompt);
  return {
    customPrompt: legacyPrompt,
    // Default ON: only an explicit false stays off.
    customPromptEnabled: cached.customPromptEnabled !== false,
    customPrompts: normalizeTuningList(
      (cached as TuningConfig).customPrompts,
      legacyPrompt,
      cached.customPromptEnabled
    ),
    mutedFolderPromptIds: Array.isArray((cached as TuningConfig).mutedFolderPromptIds)
      ? (cached as TuningConfig).mutedFolderPromptIds!.filter((id): id is string => typeof id === "string")
      : [],
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

type TuningResponse = {
  id: string;
  customPrompt: string | null;
  customPromptEnabled: boolean;
  customPrompts?: TuningPromptItem[];
  mutedFolderPromptIds?: string[];
};

const toConfig = (t: TuningResponse | undefined, fallback: TuningConfig): TuningConfig => ({
  customPrompt: t?.customPrompt ?? fallback.customPrompt,
  customPromptEnabled: t?.customPromptEnabled ?? fallback.customPromptEnabled,
  customPrompts: normalizeTuningList(t?.customPrompts, t?.customPrompt ?? fallback.customPrompt, t?.customPromptEnabled ?? fallback.customPromptEnabled),
  mutedFolderPromptIds: Array.isArray(t?.mutedFolderPromptIds)
    ? t.mutedFolderPromptIds.filter((id): id is string => typeof id === "string")
    : (fallback.mutedFolderPromptIds ?? []),
});

export async function fetchTuning(conversationId: string): Promise<TuningConfig> {
  const res = await apiFetch<ApiResponse<{ tuning: TuningResponse }>>(
    `/api/conversations/${conversationId}/tuning`
  );
  const t = res.data?.tuning;
  const cfg = toConfig(t, { customPrompt: null, customPromptEnabled: true, customPrompts: [], mutedFolderPromptIds: [] });
  writeCachedTuning(conversationId, cfg);
  return cfg;
}

export async function saveTuning(
  conversationId: string,
  cfg: { customPrompts: TuningPromptItem[]; mutedFolderPromptIds?: string[] }
): Promise<TuningConfig> {
  const res = await apiFetch<ApiResponse<{ tuning: TuningResponse }>>(
    `/api/conversations/${conversationId}/tuning`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customPrompts: cfg.customPrompts.map((p) => ({ id: p.id, text: p.text, enabled: p.enabled })),
        mutedFolderPromptIds: cfg.mutedFolderPromptIds ?? [],
      }),
    }
  );
  const t = res.data?.tuning;
  const next = toConfig(t, {
    customPrompt: null,
    customPromptEnabled: true,
    customPrompts: cfg.customPrompts,
    mutedFolderPromptIds: cfg.mutedFolderPromptIds ?? [],
  });
  writeCachedTuning(conversationId, next);
  return next;
}
