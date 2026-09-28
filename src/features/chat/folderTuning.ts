// Folder-level Tuning — same contract as per-chat tuning (chatTuning.ts),
// backed by /api/folders/:id/tuning. A folder prompt is inherited at read
// time by every chat inside, so one save covers the whole folder instantly.
// Default ON: only an explicit false stays off (empty prompt forces off).

import { apiFetch, ApiResponse } from "../../lib/api";
import { TUNING_MAX_LENGTH } from "./chatTuning";

export { TUNING_MAX_LENGTH };

export type FolderTuningConfig = {
  customPrompt: string | null;
  customPromptEnabled: boolean;
};

const keyFor = (folderId: string) => `chatapp.folder-tuning.${folderId}`;

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

export function readCachedFolderTuning(folderId: string): FolderTuningConfig | null {
  if (!folderId) return null;
  const cached = safeRead<FolderTuningConfig>(keyFor(folderId));
  if (!cached || typeof cached !== "object") return null;
  return {
    customPrompt: typeof cached.customPrompt === "string" ? cached.customPrompt : cached.customPrompt == null ? null : String(cached.customPrompt),
    customPromptEnabled: cached.customPromptEnabled !== false,
  };
}

export function writeCachedFolderTuning(folderId: string, cfg: FolderTuningConfig): void {
  if (!folderId) return;
  safeWrite(keyFor(folderId), cfg);
}

export async function fetchFolderTuning(folderId: string): Promise<FolderTuningConfig> {
  const res = await apiFetch<ApiResponse<{ tuning: { id: string; customPrompt: string | null; customPromptEnabled: boolean } }>>(
    `/api/folders/${folderId}/tuning`
  );
  const t = res.data?.tuning;
  const cfg: FolderTuningConfig = {
    customPrompt: t?.customPrompt ?? null,
    customPromptEnabled: t?.customPromptEnabled !== false,
  };
  writeCachedFolderTuning(folderId, cfg);
  return cfg;
}

export async function saveFolderTuning(folderId: string, cfg: FolderTuningConfig): Promise<FolderTuningConfig> {
  const res = await apiFetch<ApiResponse<{ tuning: { id: string; customPrompt: string | null; customPromptEnabled: boolean } }>>(
    `/api/folders/${folderId}/tuning`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customPrompt: cfg.customPrompt,
        customPromptEnabled: cfg.customPromptEnabled,
      }),
    }
  );
  const t = res.data?.tuning;
  const next: FolderTuningConfig = {
    customPrompt: t?.customPrompt ?? cfg.customPrompt ?? null,
    customPromptEnabled: t?.customPromptEnabled ?? cfg.customPromptEnabled,
  };
  writeCachedFolderTuning(folderId, next);
  return next;
}
