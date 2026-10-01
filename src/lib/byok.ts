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
  // True when every model on the provider sits under a free tier
  // (Groq / NVIDIA dev tiers) — "Free only" keeps the whole list.
  allModelsFree?: boolean;
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
    allModelsFree: true,
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
    allModelsFree: true,
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
    // Fallback shortlist (live /v1/models wins when reachable): public ids
    // observed on the catalog. Keeps the dropdown usable offline.
    models: [
      "gpt-5.6-luna",
      "deepseek-v4-flash-0731",
      "qwen3.8-27b",
      "gemini-3.7-flash",
      "kimi-k2.6",
      "grok-4.5",
    ],
  },
];

export const getByokProvider = (
  id: string | null | undefined
): ByokProviderInfo | null => BYOK_PROVIDERS.find((p) => p.id === id) ?? null;

// Permissive when provider was added dynamically by an admin (unknown at
// build time). Any lowercase slug is kept; BYOK activation uses a generic
// key pattern when the registry has no entry.
export const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;
export const isValidByokProviderId = (id: string) => PROVIDER_ID_RE.test(id.trim().toLowerCase());

export type ServerProviderInfo = {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  keyHint: string;
  keyPattern: string;
  keylessModels: boolean;
  models: string[];
  source: "builtin" | "custom";
};

export type ByokConfig = {
  provider: string | null;
  model: string;
  apiKey: string;
  // Saved API keys per provider — "Save key" in Settings writes the key here
  // so switching providers auto-loads each provider's saved key.
  apiKeys?: Record<string, string>;
  // Live model lists fetched per provider id (keyed lists survive reloads).
  models?: Record<string, string[]>;
  // Free-tier model ids per provider, reported by the catalog endpoint.
  freeModels?: Record<string, string[]>;
  // When true, model dropdowns show only free models where the provider
  // reports a free tier.
  freeOnly?: boolean;
};

const STORAGE_KEY = "byokConfig";
const BYOK_EVENT = "byok-config-changed";

export const getByokConfig = (): ByokConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rawProvider = typeof parsed.provider === "string" ? parsed.provider.trim().toLowerCase() : "";
    const provider = rawProvider && isValidByokProviderId(rawProvider) ? rawProvider : null;
    const rawKeys =
      parsed.apiKeys && typeof parsed.apiKeys === "object" ? parsed.apiKeys : {};
    const apiKeys: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawKeys)) {
      const key = String(k).trim().toLowerCase();
      if (key && isValidByokProviderId(key) && typeof v === "string" && v.length > 0) apiKeys[key] = v;
    }
    return {
      provider,
      model: typeof parsed.model === "string" ? parsed.model : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      apiKeys,
      freeOnly: parsed.freeOnly === true,
      models:
        parsed.models && typeof parsed.models === "object"
          ? parsed.models
          : parsed.verifiedModels && typeof parsed.verifiedModels === "object"
            ? parsed.verifiedModels
            : undefined,
      freeModels:
        parsed.freeModels && typeof parsed.freeModels === "object"
          ? parsed.freeModels
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

// Stored assistant rows carry "provider:model" (e.g. "codecraft:gpt-x").
// The chat path needs the plain provider model id — strip the prefix, and
// only when it matches (never touch ":free" suffixed OpenRouter ids).
export const stripProviderPrefix = (
  providerId: string,
  model: string
): string => {
  const prefix = `${providerId}:`;
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
};

// The key a provider should use: its saved entry wins; the loose apiKey field
// remains as a back-compat fallback for configs written before per-provider
// key storage existed.
export const resolveByokApiKey = (cfg: ByokConfig): string => {
  if (!cfg.provider) return "";
  const fromMap = cfg.apiKeys?.[cfg.provider];
  return (typeof fromMap === "string" && fromMap.trim()) || cfg.apiKey || "";
};

export const saveByokApiKey = (providerId: string, key: string) => {
  const pid = providerId.trim().toLowerCase();
  const cfg = getByokConfig() ?? { provider: null, model: "", apiKey: "" };
  const nextKeys = { ...(cfg.apiKeys ?? {}) };
  const trimmed = key.trim();
  if (trimmed) nextKeys[pid] = trimmed;
  else delete nextKeys[pid];
  saveByokConfig({
    ...cfg,
    apiKeys: nextKeys,
    apiKey: cfg.provider === pid ? trimmed : cfg.apiKey,
  });
};

// BYOK is active the moment a provider is chosen with a well-formed (saved)
// key and a model — no separate toggle. Choosing "Default (built-in
// OpenRouter)" (or a missing key) returns the app to the server models.
// Unknown (admin-added) providers use a permissive format check so a fresh
// custom endpoint isn't blocked by a missing RegExp before /validate.
export const getActiveByok = (): (ByokConfig & { provider: string; apiKey: string }) | null => {
  const cfg = getByokConfig();
  if (!cfg || !cfg.provider) return null;
  const provider = getByokProvider(cfg.provider);
  const apiKey = resolveByokApiKey(cfg);
  if (provider) {
    if (!isByokKeyFormatSupported(provider, apiKey)) return null;
  } else {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{7,}$/.test(apiKey.trim())) return null;
  }
  if (!cfg.model.trim()) return null;
  return { ...cfg, apiKey } as ByokConfig & { provider: string; apiKey: string };
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
// as a request header to our own API). freeIds is populated when the provider
// reports free tiers (OpenRouter pricing / ":free" ids / all-free providers).
export const fetchByokModels = async (
  providerId: string,
  apiKey?: string
): Promise<{ models: string[]; freeIds: string[]; message?: string }> => {
  try {
    const res = await apiFetch<
      ApiResponse<{ models: string[]; freeIds?: string[]; message?: string }>
    >("/api/byok/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: providerId,
        ...(apiKey && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    });
    return {
      models: Array.isArray(res?.data?.models) ? res.data.models : [],
      freeIds: Array.isArray(res?.data?.freeIds) ? res.data.freeIds! : [],
      message: typeof res?.data?.message === "string" ? res.data.message : undefined,
    };
  } catch (e: any) {
    // Transport/HTTP failure (unknown provider, 401 session, network…):
    // return the reason instead of throwing so callers show it, not a
    // generic "could not load" note.
    const message =
      (typeof e?.error?.message === "string" && e.error.message) ||
      (typeof e?.message === "string" && e.message) ||
      undefined;
    return { models: [], freeIds: [], message };
  }
};

// Hierarchical model picker: providers with a locally saved API key — the
// only ones the composer Provider dropdown offers. Legacy single-key configs
// count too. Sorted for a stable menu order.
export const savedByokProviders = (): Array<{ id: string; apiKey: string }> => {
  const cfg = getByokConfig();
  if (!cfg) return [];
  const out: Array<{ id: string; apiKey: string }> = [];
  const seen = new Set<string>();
  for (const [k, v] of Object.entries(cfg.apiKeys ?? {})) {
    const id = String(k).trim().toLowerCase();
    if (id && isValidByokProviderId(id) && typeof v === "string" && v.trim() && !seen.has(id)) {
      seen.add(id);
      out.push({ id, apiKey: v.trim() });
    }
  }
  if (cfg.provider && cfg.apiKey && !seen.has(cfg.provider)) {
    out.push({ id: cfg.provider, apiKey: cfg.apiKey });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
};

// Switch ongoing chats to providerId/model, preserving saved keys, cached
// catalogs and filters. Dropping apiKeys here would silently deactivate
// other providers' saved keys.
export const activateByokProvider = (providerId: string, model: string) => {
  const pid = providerId.trim().toLowerCase();
  const cfg = getByokConfig();
  const keys = { ...(cfg?.apiKeys ?? {}) };
  const fromMap = keys[pid];
  const apiKey =
    (typeof fromMap === "string" && fromMap.trim()) ||
    (cfg?.provider === pid ? cfg?.apiKey ?? "" : "");
  saveByokConfig({
    provider: pid,
    model,
    apiKey,
    apiKeys: keys,
    models: cfg?.models,
    freeModels: cfg?.freeModels,
    freeOnly: cfg?.freeOnly,
  });
};

// Switch ongoing chats back to the built-in (server) models, preserving
// saved keys and cached catalogs for later. The composer's "Default" entry
// (admin/owner only) uses this.
export const deactivateByok = () => {
  const cfg = getByokConfig();
  saveByokConfig({
    provider: null,
    model: "default",
    apiKey: "",
    apiKeys: cfg?.apiKeys,
    models: cfg?.models,
    freeModels: cfg?.freeModels,
    freeOnly: cfg?.freeOnly,
  });
};

// Per-turn provider override for media sends (image/video analysis cards):
// headers for an explicitly chosen provider+model, keyed from the saved
// per-provider keys. Empty object when the key is missing — callers then
// fall back to the normal active-provider headers.
export const getByokHeadersFor = (
  providerId: string,
  model: string
): Record<string, string> => {
  const pid = providerId.trim().toLowerCase();
  const cleanModel = model.trim();
  if (!pid || !cleanModel) return {};
  let apiKey = "";
  try {
    const cfg = getByokConfig();
    const fromMap = cfg?.apiKeys?.[pid];
    apiKey =
      (typeof fromMap === "string" && fromMap.trim()) ||
      (cfg?.provider === pid ? cfg?.apiKey ?? "" : "");
  } catch {
    apiKey = "";
  }
  if (!apiKey.trim()) return {};
  return {
    "x-byok-provider": pid,
    "x-byok-model": cleanModel,
    "x-byok-key": apiKey.trim(),
  };
};
