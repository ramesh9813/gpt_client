import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * HOW TO ADD A THEME
 * 1. Add a new id to `BrandId` (e.g. `"mybrand"`).
 * 2. Append `{ id, name, tagline }` to `BRANDS`.
 * 3. Add CSS overrides keyed on `:root[data-brand="<id>"]`
 *    (keep light/dark via existing `[data-theme]` selectors; do not
 *    re-implement `applyTheme` logic here).
 * 4. No other code changes needed — `loadBrand`/`applyBrand`/
 *    `BrandThemeProvider` pick up the new entry automatically.
 */

/** Brand identifier for the app-level brand theme (independent of light/dark). */
export type BrandId = "default" | "chatgpt" | "claude" | "gemini" | "grok" | "deepseek";

/** Catalog of selectable brand themes shown in settings / switcher UI. */
export const BRANDS: Array<{ id: BrandId; name: string; tagline: string }> = [
  { id: "default", name: "Default", tagline: "Neutral app original" },
  { id: "chatgpt", name: "ChatGPT", tagline: "Clean, neutral, minimal" },
  { id: "claude", name: "Claude", tagline: "Warm, editorial, serif" },
  { id: "gemini", name: "Gemini", tagline: "Google-style, colorful, airy" },
  { id: "grok", name: "Grok", tagline: "Dark, high-contrast, futuristic" },
  { id: "deepseek", name: "DeepSeek", tagline: "Compact, cool blue, technical" },
];

/** localStorage key used to persist the selected brand. */
export const BRAND_STORAGE_KEY = "app-theme";

/**
 * Type guard: returns true when `value` is a known `BrandId`.
 * @param value - Unknown value (e.g. from localStorage) to check.
 */
export function isBrandId(value: unknown): value is BrandId {
  return (
    typeof value === "string" &&
    (BRANDS as Array<{ id: string }>).some((b) => b.id === value)
  );
}

/**
 * Load the persisted brand from localStorage.
 * Falls back to `"default"` when missing, invalid, or storage is unavailable.
 */
export function loadBrand(): BrandId {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "default";
    const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);
    if (raw !== null && isBrandId(raw)) return raw;
    // Tolerate JSON-encoded strings from older writers: `"chatgpt"`.
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isBrandId(parsed)) return parsed;
      } catch {
        /* ignore: treat as missing */
      }
    }
  } catch {
    /* ignore: storage unavailable (private mode / SSR) */
  }
  return "default";
}

/**
 * Apply a brand theme: sets `data-brand` on `<html>` and persists it.
 * Composes with existing `applyTheme` (which owns `data-theme`,
 * `data-font-scale`, `--accent`); this function never touches those.
 * No reload, no fetch, no conversation/sidebar/scroll side effects.
 * @param brand - Brand to activate and persist.
 */
export function applyBrand(brand: BrandId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-brand", brand);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
    }
  } catch {
    /* ignore: persistence is best-effort */
  }
}

/**
 * Boot helper for app startup (call alongside existing `initTheme()`).
 * Reads the persisted brand and applies it; safe to call before React mounts.
 * @returns The brand that was applied.
 */
export function initBrand(): BrandId {
  const brand = loadBrand();
  applyBrand(brand);
  return brand;
}

/** Value exposed by `BrandThemeProvider` / `useBrandTheme()`. */
export interface BrandThemeValue {
  brand: BrandId;
  setBrand: (next: BrandId) => void;
  availableThemes: typeof BRANDS;
}

const BrandThemeContext = createContext<BrandThemeValue | null>(null);

/**
 * Provider that owns the current brand state.
 * Place above settings/switcher UI (e.g. next to existing providers in `main.tsx`).
 * `setBrand` only updates the root `data-brand` attribute + storage;
 * it never touches conversation, sidebar, or scroll state.
 */
export function BrandThemeProvider({
  children,
  initialBrand,
}: {
  children: ReactNode;
  initialBrand?: BrandId;
}): ReactNode {
  const [brand, setBrandState] = useState<BrandId>(() => initialBrand ?? loadBrand());

  // Keep DOM in sync on mount + when brand changes (covers external `applyBrand` drift).
  useEffect(() => {
    applyBrand(brand);
  }, [brand]);

  /** Switch brand without reload/fetch and without touching app state. */
  const setBrand = useCallback((next: BrandId) => {
    if (!isBrandId(next)) return;
    applyBrand(next); // root attribute + storage only
    setBrandState(next);
  }, []);

  const value = useMemo<BrandThemeValue>(
    () => ({ brand, setBrand, availableThemes: BRANDS }),
    [brand, setBrand],
  );

  return <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>;
}

/**
 * Hook to read/switch the brand theme.
 * Must be used inside `<BrandThemeProvider>`.
 * @returns `{ brand, setBrand, availableThemes }`.
 */
export function useBrandTheme(): BrandThemeValue {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) throw new Error("useBrandTheme must be used within <BrandThemeProvider>");
  return ctx;
}
