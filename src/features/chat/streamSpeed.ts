export const STREAM_WPS_MIN = 10;
export const STREAM_WPS_MAX = 80;
export const STREAM_WPS_DEFAULT = 35;
export const STREAM_WPS_KEY = "chatapp.stream.wps";

export const clampWps = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return STREAM_WPS_DEFAULT;
  return Math.min(STREAM_WPS_MAX, Math.max(STREAM_WPS_MIN, Math.round(n)));
};

export const readStreamWps = (): number => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return STREAM_WPS_DEFAULT;
    return clampWps(window.localStorage.getItem(STREAM_WPS_KEY));
  } catch {
    return STREAM_WPS_DEFAULT;
  }
};

export const saveStreamWps = (wps: number): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STREAM_WPS_KEY, String(clampWps(wps)));
    window.dispatchEvent(new Event("chatapp.stream.wps-changed"));
  } catch {}
};

export const subscribeStreamWps = (cb: () => void): (() => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STREAM_WPS_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("chatapp.stream.wps-changed", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("chatapp.stream.wps-changed", onCustom);
    window.removeEventListener("storage", onStorage);
  };
};

// chars per second at given WPS — avg 5 chars/word is the standard estimate
export const wpsToCps = (wps: number): number => clampWps(wps) * 5;
