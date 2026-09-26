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
  | "nvidia"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "groq"
  | "mistral"
  | "anthropic"
  | "cleanapis"
  | "infron"
  | "apinex"
  | "codecraft";

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
    // Legacy keys start "AIza"; newer AI Studio keys look like "AQ.…"
    // (dot-containing). Accept both formats.
    keyHint: "AIza... or AQ....",
    keyPattern: /^(AIza[A-Za-z0-9_-]{20,}|[A-Za-z0-9][A-Za-z0-9_.-]{24,})$/,
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
  {
    id: "deepseek",
    name: "DeepSeek",
    keyHint: "sk-...",
    keyPattern: /^sk-[A-Za-z0-9]{20,}$/,
    modelsPublic: false,
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    keyHint: "sk-...",
    keyPattern: /^sk-[A-Za-z0-9]{20,}$/,
    modelsPublic: false,
    models: [
      "qwen-max",
      "qwen-plus",
      "qwen-turbo",
      "qwen3-235b-a22b",
      "qwen3-30b-a3b",
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    keyHint: "sk-...",
    keyPattern: /^sk-[A-Za-z0-9]{20,}$/,
    modelsPublic: false,
    models: [
      "kimi-k2-0711-preview",
      "kimi-latest",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
  },
  {
    id: "groq",
    name: "Groq",
    keyHint: "gsk_...",
    keyPattern: /^gsk_[A-Za-z0-9]{20,}$/,
    modelsPublic: false,
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    keyHint: "30+ character token",
    keyPattern: /^[A-Za-z0-9]{30,}$/,
    modelsPublic: false,
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "codestral-latest",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    keyHint: "sk-ant-...",
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    modelsPublic: false,
    models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  },
  {
    id: "cleanapis",
    name: "CleanAPIs",
    keyHint: "cc_...",
    keyPattern: /^cc_[A-Za-z0-9_-]{16,}$/,
    modelsPublic: false,
    models: [],
  },
  {
    id: "infron",
    name: "Infron",
    keyHint: "your API key",
    keyPattern: /^[A-Za-z0-9][A-Za-z0-9_.-]{15,}$/,
    modelsPublic: true,
    models: [],
  },
  {
    id: "apinex",
    name: "APInex",
    keyHint: "your API key",
    keyPattern: /^[A-Za-z0-9][A-Za-z0-9_.-]{15,}$/,
    modelsPublic: false,
    models: [],
  },
  {
    id: "codecraft",
    name: "CodeCraft API",
    keyHint: "cc_...",
    keyPattern: /^cc_[A-Za-z0-9_-]{16,}$/,
    modelsPublic: false,
    models: [],
  },
];

export const getByokProvider = (
  id: string | null | undefined
): ByokProviderInfo | null => BYOK_PROVIDERS.find((p) => p.id === id) ?? null;

export type ByokConfig = {
  provider: ByokProviderId | null;
  model: string;
  apiKey: string;
  // Saved API keys per provider — "Save key" in Settings writes the key here
  // so switching providers auto-loads each provider's saved key.
  apiKeys?: Partial<Record<ByokProviderId, string>>;
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
    const rawKeys =
      parsed.apiKeys && typeof parsed.apiKeys === "object" ? parsed.apiKeys : {};
    const apiKeys: Partial<Record<ByokProviderId, string>> = {};
    for (const [k, v] of Object.entries(rawKeys)) {
      const pid = getByokProvider(k)?.id;
      if (pid && typeof v === "string" && v.length > 0) apiKeys[pid] = v;
    }
    return {
      provider,
      model: typeof parsed.model === "string" ? parsed.model : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      apiKeys,
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

// The key a provider should use: its saved entry wins; the loose apiKey field
// remains as a back-compat fallback for configs written before per-provider
// key storage existed.
export const resolveByokApiKey = (cfg: ByokConfig): string => {
  if (!cfg.provider) return "";
  const fromMap = cfg.apiKeys?.[cfg.provider];
  return (typeof fromMap === "string" && fromMap.trim()) || cfg.apiKey || "";
};

export const saveByokApiKey = (providerId: ByokProviderId, key: string) => {
  const cfg = getByokConfig() ?? { provider: null, model: "", apiKey: "" };
  const nextKeys = { ...(cfg.apiKeys ?? {}) };
  const trimmed = key.trim();
  if (trimmed) nextKeys[providerId] = trimmed;
  else delete nextKeys[providerId];
  saveByokConfig({
    ...cfg,
    apiKeys: nextKeys,
    apiKey: cfg.provider === providerId ? trimmed : cfg.apiKey,
  });
};

// BYOK is active the moment a provider is chosen with a well-formed (saved)
// key and a model — no separate toggle. Choosing "Default (built-in
// OpenRouter)" (or a missing key) returns the app to the server models.
export const getActiveByok = (): (ByokConfig &
  { provider: ByokProviderId; apiKey: string }) | null => {
  const cfg = getByokConfig();
  if (!cfg || !cfg.provider) return null;
  const provider = getByokProvider(cfg.provider);
  const apiKey = resolveByokApiKey(cfg);
  if (!provider || !isByokKeyFormatSupported(provider, apiKey)) return null;
  if (!cfg.model.trim()) return null;
  return { ...cfg, apiKey } as ByokConfig & {
    provider: ByokProviderId;
    apiKey: string;
  };
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
