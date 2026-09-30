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
  pcm: Float32Array
): Promise<string | null> => {
  const { transcribeSpeechAudio } = await import(
    "../features/chat/voice/whisper"
  );
  const text = await transcribeSpeechAudio(pcm);
  return text && text.trim() ? text.trim() : null;
};

export type TranscribeResult = {
  text: string;
  truncated: boolean;
  via: "cloud" | "device";
};

export type TranscribeCallbacks = {
  // Fired per finished chunk, in order — append, never replace.
  onPartial?: (text: string, index: number) => void;
  onProgress?: (done: number, total: number) => void;
};

// Streaming transcription: the clip is decoded once (fast, native), then cut
// into 15s non-overlapping PCM segments transcribed in order. Each finished
// segment emits immediately so the textarea types live; past text is only
// ever appended to. Chunking removes the lag layers of the old flow (one
// giant request + one giant inference + nothing painted until the end).
const SEGMENT_SECONDS = 15;
const SAMPLE_RATE = 16000;

const sliceSegments = (pcm: Float32Array): Float32Array[] => {
  const per = SAMPLE_RATE * SEGMENT_SECONDS;
  const out: Float32Array[] = [];
  for (let i = 0; i < pcm.length; i += per) out.push(pcm.slice(i, i + per));
  return out;
};

// 16kHz mono float32 → WAV blob, so cloud chunks travel as proper audio files.
const pcmToWavBlob = (pcm: Float32Array): Blob => {
  const len = pcm.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const wstr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  wstr(0, "RIFF");
  v.setUint32(4, 36 + len * 2, true);
  wstr(8, "WAVE");
  wstr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  wstr(36, "data");
  v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
};

// Shared entry for mic + audio files: cloud transcriber when one is chosen
// AND its key is saved, otherwise the on-device default. A failing chunk
// falls back per-chunk so one bad slice never kills the transcript.
export const transcribeAudioBlob = async (
  blob: Blob,
  callbacks?: TranscribeCallbacks
): Promise<TranscribeResult | null> => {
  const active = getActiveTranscriber();
  const cloud =
    !!active &&
    !!savedKeyForProvider(active.provider) &&
    blob.size > 0 &&
    blob.size <= 25 * 1024 * 1024;
  try {
    const { blobToSpeechAudio } = await import(
      "../features/chat/voice/whisper"
    );
    const pcm = await blobToSpeechAudio(blob);
    if (!pcm || pcm.length === 0) return null;
    // Mobile RAM safety for the device path: first 3 minutes only.
    const MAX_SAMPLES = SAMPLE_RATE * 180;
    const capped =
      !cloud && pcm.length > MAX_SAMPLES ? pcm.slice(0, MAX_SAMPLES) : pcm;
    const truncated = capped.length < pcm.length;
    const segments = sliceSegments(capped);
    const parts: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      let t: string | null = null;
      if (cloud && active) {
        try {
          t = await transcribeViaCloud(
            active.provider,
            active.model,
            pcmToWavBlob(segments[i])
          );
        } catch {
          t = null;
        }
      }
      if (!t) {
        try {
          t = await transcribeViaDevice(segments[i]);
        } catch {
          t = null;
        }
      }
      if (t) {
        parts.push(t);
        callbacks?.onPartial?.(t, i);
      }
      callbacks?.onProgress?.(i + 1, segments.length);
    }
    const text = parts.join(" ").trim();
    if (!text) return null;
    return { text, truncated, via: cloud ? "cloud" : "device" };
  } catch {
    // undecodable — caller keeps its placeholder
    return null;
  }
};
