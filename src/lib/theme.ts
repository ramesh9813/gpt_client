export type ThemeMode = "SYSTEM" | "DARK" | "LIGHT";
export type FontScale = "SMALL" | "DEFAULT" | "LARGE";

export const applyTheme = (
  theme: ThemeMode,
  accentColor: string,
  fontScale: FontScale
) => {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const resolved = theme === "SYSTEM" ? (systemPrefersDark ? "dark" : "light") : theme.toLowerCase();

  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-font-scale", fontScale);
  root.style.setProperty("--accent", accentColor);
};