// Image/video analysis routing: dedicated provider+model per media kind.
// When you send an image (or video), that turn alone goes to the card's
// model — the chat model never changes. "Default (chat model)" keeps the
// old behavior. Stored locally; nothing leaves the browser except the turn.
export type MediaKind = "image" | "video";

export type MediaModelChoice = {
  provider: string | null;
  model: string;
};

type MediaModelsConfig = {
  image: MediaModelChoice;
  video: MediaModelChoice;
};

const STORAGE_KEY = "mediaModelsConfig";
const MEDIA_EVENT = "media-models-changed";

const EMPTY: MediaModelsConfig = {
  image: { provider: null, model: "" },
  video: { provider: null, model: "" },
};

const cleanChoice = (v: unknown): MediaModelChoice => {
  if (!v || typeof v !== "object") return { provider: null, model: "" };
  const o = v as Record<string, unknown>;
  const provider =
    typeof o.provider === "string" && o.provider.trim()
      ? o.provider.trim().toLowerCase()
      : null;
  const model = typeof o.model === "string" ? o.model.trim() : "";
  return { provider, model };
};

export const getMediaModelsConfig = (): MediaModelsConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    return {
      image: cleanChoice((parsed as Record<string, unknown>).image),
      video: cleanChoice((parsed as Record<string, unknown>).video),
    };
  } catch {
    return { ...EMPTY };
  }
};

export const saveMediaModelsConfig = (config: MediaModelsConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event(MEDIA_EVENT));
  } catch {
    // storage unavailable — routing stays default
  }
};

export const subscribeMediaModels = (cb: () => void): (() => void) => {
  window.addEventListener(MEDIA_EVENT, cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MEDIA_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
};

const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v"]);

const isVideoFile = (f: { name?: string; mime?: string }): boolean => {
  const mime = typeof f?.mime === "string" ? f.mime : "";
  if (mime.startsWith("video/")) return true;
  const name = typeof f?.name === "string" ? f.name : "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return VIDEO_EXTS.has(ext);
};

// One-turn override for media sends: images → image card, video files →
// video card. Returns null for "Default (chat model)" or unconfigured cards.
export const getMediaTurnOverride = (args: {
  images?: string[];
  files?: Array<{ name: string; mime: string; size: number }>;
}): { provider: string; model: string } | null => {
  const cfg = getMediaModelsConfig();
  if (args.images && args.images.length > 0) {
    const c = cfg.image;
    if (c.provider && c.model) return { provider: c.provider, model: c.model };
    return null;
  }
  if (args.files && args.files.some(isVideoFile)) {
    const c = cfg.video;
    if (c.provider && c.model) return { provider: c.provider, model: c.model };
    return null;
  }
  return null;
};
