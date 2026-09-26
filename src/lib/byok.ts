// Bring-your-own-key (BYOK): users can chat with their own provider API key
// (OpenAI, Google, Grok, Meta, NVIDIA) instead of the built-in OpenRouter
// stack. The config — including the API key — lives ONLY in this browser's
// localStorage and is sent per chat request via x-byok-* headers. It is never
// saved in the app's database.

export type ByokProviderId = "openai" | "google" | "grok" | "meta" | "nvidia";

export type ByokProviderInfo = {
  id: ByokProviderId;
  name: string;
  keyHint: string;
  // Instant format check, mirrors the server registry.
  keyPattern: RegExp;
  // Curated fallback list; the "Verify key" action replaces it with the live
  // provider catalog for the entered key.
  models: string[];
};

export const BYOK_PROVIDERS: ByokProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    keyHint: "sk-...",
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
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
    models: ["grok-4", "grok-3", "grok-3-fast", "grok-3-mini", "grok-2-1212"],
  },
  {
    id: "meta",
    name: "Meta Llama",
    keyHint: "LLM|...",
    keyPattern: /^(LLM\|[A-Za-z0-9_|.-]{8,}|[A-Za-z0-9_-]{20,})$/,
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
): ByokProviderInfo | null =>
  BYOK_PROVIDERS.find((p) => p.id === id) ?? null;

export type ByokConfig = {
  provider: ByokProviderId | null;
  model: string;
  apiKey: string;
  enabled: boolean;
  // Live model lists fetched at last successful verify, per provider id.
  verifiedModels?: Partial<Record<ByokProviderId, string[]>>;
};

const STORAGE_KEY = "byokConfig";

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
      enabled: parsed.enabled === true,
      verifiedModels:
        parsed.verifiedModels && typeof parsed.verifiedModels === "object"
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
  } catch {
    // storage unavailable — feature silently off
  }
};

export const clearByokConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const isByokKeyFormatSupported = (
  provider: ByokProviderInfo,
  apiKey: string
): boolean => provider.keyPattern.test(apiKey.trim());

export const getActiveByok = (): (ByokConfig & { provider: ByokProviderId }) | null => {
  const cfg = getByokConfig();
  if (!cfg || !cfg.enabled || !cfg.provider) return null;
  if (!cfg.model.trim() || !cfg.apiKey.trim()) return null;
  return cfg as ByokConfig & { provider: ByokProviderId };
};

// Headers to attach to /api/chat/stream when BYOK is active. Empty object
// otherwise so the request (and the whole OpenRouter path) is unchanged.
export const getByokHeaders = (): Record<string, string> => {
  const cfg = getActiveByok();
  if (!cfg) return {};
  return {
    "x-byok-provider": cfg.provider,
    "x-byok-model": cfg.model,
    "x-byok-key": cfg.apiKey,
  };
};
