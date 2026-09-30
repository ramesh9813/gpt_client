// Speech-to-text engine picker: cloud provider model (via the server
// /api/byok/transcribe proxy, using the key saved in Settings → AI
// provider) or the on-device Whisper default. Nothing here is stored
// server-side; the transcriber choice lives in this browser's localStorage.
import { apiFetch, type ApiResponse } from "./api";
import { getByokConfig } from "./byok";

// Transcription-capable model shortlists per built-in provider id.
// Custom (owner-added) providers are assumed OpenAI-compatible — the server
// gate reports otherwise with a plain message.
export const TRANSCRIBE_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"],
  groq: ["whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"],
};

// Built-in providers whose API is OpenAI-shaped (transcription endpoint
// compatible). Custom providers skip this check (server gates by kind).
const OPENAI_SHAPED_IDS = new Set([
  "openrouter",
  "openai",
  "grok",
  "meta",
  "nvidia",
  "deepseek",
  "qwen",
  "moonshot",
  "groq",
  "mistral",
  "cleanapis",
  "infron",
  "apinex",
  "codecraft",
]);

export const transcribeModelsFor = (providerId: string | null): string[] => {
  if (!providerId) return [];
  return TRANSCRIBE_MODELS[providerId.trim().toLowerCase()] ?? [];
};

export const isKnownTranscribeProvider = (id: string): boolean =>
  OPENAI_SHAPED_IDS.has(id.trim().toLowerCase());

export type TranscribeConfig = {
  provider: string | null;
  model: string;
};

const STORAGE_KEY = "transcribeConfig";
const TRANSCRIBE_EVENT = "transcribe-config-changed";

export const getTranscribeConfig = (): TranscribeConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { provider: null, model: "" };
    const parsed = JSON.parse(raw);
    const provider =
      typeof parsed?.provider === "string" && parsed.provider.trim()
        ? parsed.provider.trim().toLowerCase()
        : null;
    return {
      provider,
      model: typeof parsed?.model === "string" ? parsed.model : "",
    };
  } catch {
    return { provider: null, model: "" };
  }
};

export const saveTranscribeConfig = (config: TranscribeConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event(TRANSCRIBE_EVENT));
  } catch {
    // storage unavailable — default transcriber stays
  }
};

export const subscribeTranscribe = (cb: () => void): (() => void) => {
  window.addEventListener(TRANSCRIBE_EVENT, cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(TRANSCRIBE_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
};

// Active cloud transcriber: provider + model both chosen. Key presence is
// checked at use/verify time against the AI-provider saved keys.
export const getActiveTranscriber = (): { provider: string; model: string } | null => {
  const cfg = getTranscribeConfig();
  if (!cfg.provider || !cfg.model.trim()) return null;
  return { provider: cfg.provider, model: cfg.model.trim() };
};

// Saved AI-provider key for an arbitrary provider id (same store the AI
// provider card writes).
export const savedKeyForProvider = (providerId: string): string => {
  try {
    const stored = getByokConfig();
    const pid = providerId.trim().toLowerCase();
    const fromMap = stored?.apiKeys?.[pid];
    if (typeof fromMap === "string" && fromMap.trim()) return fromMap.trim();
    if (stored?.provider === pid && stored.apiKey) return stored.apiKey;
  } catch {
    // ignore — no key
  }
  return "";
};

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Failed to read audio"));
    r.readAsDataURL(blob);
  });

const transcribeViaCloud = async (
  providerId: string,
  model: string,
  blob: Blob
): Promise<string | null> => {
  const apiKey = savedKeyForProvider(providerId);
  if (!apiKey) return null;
  if (blob.size === 0 || blob.size > 25 * 1024 * 1024) return null;
  const audio = await blobToDataURL(blob);
  if (!audio.startsWith("data:audio/")) return null;
  const res = await apiFetch<ApiResponse<{ text: string; message?: string }>>(
    "/api/byok/transcribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerId, apiKey, model, audio }),
    }
  );
  const text = res?.data?.text?.trim() ?? "";
  return text ? text : null;
};

const transcribeViaDevice = async (
  blob: Blob
): Promise<{ text: string; truncated: boolean } | null> => {
  const { blobToSpeechAudio, transcribeSpeechAudio } = await import(
    "../features/chat/voice/whisper"
  );
  const audio = await blobToSpeechAudio(blob);
  if (!audio || audio.length === 0) return null;
  // Mobile RAM safety: first 3 minutes only.
  const MAX_SAMPLES = 16000 * 180;
  const slice = audio.length > MAX_SAMPLES ? audio.slice(0, MAX_SAMPLES) : audio;
  const text = await transcribeSpeechAudio(slice);
  if (!text || !text.trim()) return null;
  return { text: text.trim(), truncated: audio.length > MAX_SAMPLES };
};

export type TranscribeResult = {
  text: string;
  truncated: boolean;
  via: "cloud" | "device";
};

// Shared entry for mic + audio files: cloud transcriber when one is chosen
// AND its key is saved, otherwise the on-device default. Cloud failures fall
// back to the device so a turn never dies voiceless.
export const transcribeAudioBlob = async (blob: Blob): Promise<TranscribeResult | null> => {
  const active = getActiveTranscriber();
  if (active && savedKeyForProvider(active.provider)) {
    try {
      const text = await transcribeViaCloud(active.provider, active.model, blob);
      if (text) return { text, truncated: false, via: "cloud" };
    } catch {
      // fall through to the on-device default
    }
  }
  try {
    const device = await transcribeViaDevice(blob);
    if (device) return { ...device, via: "device" };
  } catch {
    // undecodable — caller keeps its placeholder
  }
  return null;
};
