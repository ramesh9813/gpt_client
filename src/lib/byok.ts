// Bring-your-own-key (BYOK): users can chat with their own provider API key
// (OpenRouter, OpenAI, Google, Grok, Meta, NVIDIA) instead of the built-in
// server key. The config — including the API key — lives ONLY in this
// browser's localStorage and is sent per chat request via x-byok-* headers.
// It is never saved in the app's database.
//
// Model lists are dynamic: fetchByokModels() pulls the provider's live
// catalog through the server proxy; the small per-provider arrays below are
// only an offline fallback.
import { apiFetch, type ApiResponse } from "./api";

export type ByokProviderId =
  | "openrouter"
  | "openai"
  | "google"
  | "grok"
  | "meta"
  | "nvidia";

export type ByokProviderInfo = {
  id: ByokProviderId;
  name: string;
  keyHint: string;
  // Instant format check, mirrors the server registry.
  keyPattern: RegExp;
  // True when the provider's catalog can be listed WITHOUT a key.
  modelsPublic: boolean;
  // Offline/last-resort fallback list (live catalog replaces it).
  models: string[];
};

export const BYOK_PROVIDERS: ByokProviderInfo[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    keyHint: "sk-or-...",
    keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    modelsPublic: true,
    models: [
      "openai/gpt-4o-mini",
      "openai/gpt-4o",
      "google/gemini-2.5-flash",
      "anthropic/claude-sonnet-4.5",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-r1",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    keyHint: "sk-...",
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    modelsPublic: false,
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "o4-mini",
      "o3-mini",
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    keyHint: "AIza...",
    keyPattern: /^AIza[A-Za-z0-9_-]{30,}$/,
    modelsPublic: false,
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
  },
  {
    id: "grok",
    name: "Grok (xAI)",
    keyHint: "xai-...",
    keyPattern: /^xai-[A-Za-z0-9_-]{20,}$/,
    modelsPublic: false,
    models: ["grok-4", "grok-3", "grok-3-fast", "grok-3-mini", "grok-2-1212"],
  },
  {
    id: "meta",
    name: "Meta Llama",
    keyHint: "LLM|...",
    keyPattern: /^(LLM\|[A-Za-z0-9_|.-]{8,}|[A-Za-z0-9_-]{20,})$/,
    modelsPublic: false,
    models: [
      "Llama-4-Maverick-17B-128E-Instruct-FP8",
      "Llama-4-Scout-17B-16E-Instruct-FP8",
      "Llama-3.3-70B-Instruct",
      "Llama-3.3-8B-Instruct",
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    keyHint: "nvapi-...",
    keyPattern: /^nvapi-[A-Za-z0-9_-]{20,}$/,
    modelsPublic: true,
    models: [
      "meta/llama-3.3-70b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "mistralai/mistral-large-2-instruct",
      "qwen/qwen3-235b-a22b",
    ],
  },
];

export const getByokProvider = (
  id: string | null | undefined
): ByokProviderInfo | null => BYOK_PROVIDERS.find((p) => p.id === id) ?? null;

export type ByokConfig = {
  provider: ByokProviderId | null;
  model: string;
  apiKey: string;
  // Live model lists fetched per provider id (keyed lists survive reloads).
  models?: Partial<Record<ByokProviderId, string[]>>;
};

const STORAGE_KEY = "byokConfig";
const BYOK_EVENT = "byok-config-changed";

export const getByokConfig = (): ByokConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const provider = getByokProvider(parsed.provider)?.id ?? null;
    return {
      provider,
      model: typeof parsed.model === "string" ? parsed.model : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      models:
        parsed.models && typeof parsed.models === "object"
          ? parsed.models
          : parsed.verifiedModels && typeof parsed.verifiedModels === "object"
            ? parsed.verifiedModels
            : undefined,
    };
  } catch {
    return null;
  }
};

export const saveByokConfig = (config: ByokConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event(BYOK_EVENT));
  } catch {
    // storage unavailable — feature silently off
  }
};

export const clearByokConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(BYOK_EVENT));
  } catch {
    // ignore
  }
};

// Reactive subscription: same-tab saves + cross-tab storage events.
export const subscribeByok = (cb: () => void): (() => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  window.addEventListener(BYOK_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(BYOK_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
};

export const isByokKeyFormatSupported = (
  provider: ByokProviderInfo,
  apiKey: string
): boolean => provider.keyPattern.test(apiKey.trim());

// BYOK is active the moment a provider is chosen with a well-formed key and a
// model — no separate toggle. Choosing "Default (built-in OpenRouter)" (or a
// blank key) returns the app to the server-configured models.
export const getActiveByok = (): (ByokConfig & { provider: ByokProviderId }) | null => {
  const cfg = getByokConfig();
  if (!cfg || !cfg.provider) return null;
  const provider = getByokProvider(cfg.provider);
  if (!provider || !isByokKeyFormatSupported(provider, cfg.apiKey)) return null;
  if (!cfg.model.trim()) return null;
  return cfg as ByokConfig & { provider: ByokProviderId };
};

// Headers for /api/chat/stream when BYOK is active. Empty object otherwise so
// the built-in OpenRouter path is completely unchanged. modelOverride lets a
// caller (e.g. the composer/regenerate menu) pick a different provider model
// for a single turn.
export const getByokHeaders = (modelOverride?: string): Record<string, string> => {
  const cfg = getActiveByok();
  if (!cfg) return {};
  const model =
    modelOverride && modelOverride !== "default" && modelOverride.trim()
      ? modelOverride.trim()
      : cfg.model;
  return {
    "x-byok-provider": cfg.provider,
    "x-byok-model": model,
    "x-byok-key": cfg.apiKey,
  };
};

// Live model catalog via the server proxy (never hits the provider directly
// from the browser, so no CORS surprises and the key leaves this device only
// as a request header to our own API).
export const fetchByokModels = async (
  providerId: ByokProviderId,
  apiKey?: string
): Promise<string[]> => {
  const res = await apiFetch<ApiResponse<{ models: string[] }>>(
    "/api/byok/models",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerId,
        ...(apiKey && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    }
  );
  return Array.isArray(res?.data?.models) ? res.data.models : [];
};
