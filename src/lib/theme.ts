export type ThemeMode = "SYSTEM" | "DARK" | "LIGHT";
export type FontScale = "XSMALL" | "SMALL" | "DEFAULT" | "LARGE" | "XLARGE";

export const APP_FONT_MIN = 12;
export const APP_FONT_MAX = 22;
export const APP_FONT_DEFAULT = 16;
export const ICON_SCALE_MIN = 0.8;
export const ICON_SCALE_MAX = 1.6;
export const ICON_SCALE_DEFAULT = 1;

export const clampAppFontSize = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return APP_FONT_DEFAULT;
  return Math.min(APP_FONT_MAX, Math.max(APP_FONT_MIN, Math.round(n)));
};

export const clampIconScale = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return ICON_SCALE_DEFAULT;
  return Math.min(ICON_SCALE_MAX, Math.max(ICON_SCALE_MIN, Math.round(n * 100) / 100));
};

export const applyAppScale = (
  appFontSize: number = APP_FONT_DEFAULT,
  iconScale: number = ICON_SCALE_DEFAULT
) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const fontPx = clampAppFontSize(appFontSize);
  const icon = clampIconScale(iconScale);
  // Overall app zoom derived from px (16px = 100%). Scales all px/rem
  // text + layout proportionally. Icons get an extra multiplier on top.
  const appZoom = Math.round((fontPx / 16) * 1000) / 1000;
  root.style.setProperty("--app-zoom", String(appZoom));
  root.style.setProperty("--app-font-size", `${fontPx}px`);
  root.style.setProperty("--icon-scale", String(icon));
  root.setAttribute("data-app-font-size", String(fontPx));
  root.setAttribute("data-icon-scale", String(icon));
  try {
    localStorage.setItem(
      "ui_scale_pref",
      JSON.stringify({ appFontSize: fontPx, iconScale: icon })
    );
  } catch {}
};

export const readCachedAppScale = (): { appFontSize: number; iconScale: number } => {
  try {
    const cached = localStorage.getItem("ui_scale_pref");
    if (cached) {
      const { appFontSize, iconScale } = JSON.parse(cached);
      return {
        appFontSize: clampAppFontSize(appFontSize),
        iconScale: clampIconScale(iconScale),
      };
    }
  } catch {}
  return { appFontSize: APP_FONT_DEFAULT, iconScale: ICON_SCALE_DEFAULT };
};

export const applyTheme = (
  theme: ThemeMode = "SYSTEM",
  fontScale: FontScale = "DEFAULT",
  appFontSize: number = APP_FONT_DEFAULT,
  iconScale: number = ICON_SCALE_DEFAULT
) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const systemPrefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const resolved =
    theme === "SYSTEM" ? (systemPrefersDark ? "dark" : "light") : theme.toLowerCase();

  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.setAttribute("data-font-scale", fontScale);
  // Accent is owned by the Assistant theme (brand tokens); clear any legacy override.
  root.style.removeProperty("--accent");

  // Overall app font + icon scaling (sliders).
  applyAppScale(appFontSize, iconScale);

  // Update theme-color meta tag for Android status bar and browser header
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", resolved === "dark" ? "#212121" : "#ffffff");
  }

  // Cache in localStorage for immediate sync before network API loads
  try {
    localStorage.setItem("theme_pref", JSON.stringify({ theme, fontScale }));
  } catch {}
};

export const initTheme = () => {
  if (typeof window === "undefined") return;
  // Apply cached global scale first so pre-paint matches post-login.
  const scale = readCachedAppScale();
  try {
    const cached = localStorage.getItem("theme_pref");
    if (cached) {
      const { theme, fontScale } = JSON.parse(cached);
      applyTheme(theme, fontScale, scale.appFontSize, scale.iconScale);
      return;
    }
  } catch {}
  applyTheme("SYSTEM", "DEFAULT", scale.appFontSize, scale.iconScale);
};

// System theme listener for real-time OS mode sync
if (typeof window !== "undefined" && window.matchMedia) {
  try {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      try {
        const cached = localStorage.getItem("theme_pref");
        const scale = readCachedAppScale();
        if (cached) {
          const { theme, fontScale } = JSON.parse(cached);
          if (theme === "SYSTEM") {
            applyTheme("SYSTEM", fontScale, scale.appFontSize, scale.iconScale);
          }
        } else {
          applyTheme("SYSTEM", "DEFAULT", scale.appFontSize, scale.iconScale);
        }
      } catch {}
    };
    // addEventListener throws on old Safari (only addListener exists) and
    // would blank the app at import time, so feature-detect.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
    } else if (typeof (mql as unknown as { addListener?: unknown }).addListener === "function") {
      (mql as unknown as { addListener: (cb: () => void) => void }).addListener(handler);
    }
  } catch {}
}
