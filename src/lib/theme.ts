export type ThemeMode = "SYSTEM" | "DARK" | "LIGHT";
export type FontScale = "XSMALL" | "SMALL" | "DEFAULT" | "LARGE" | "XLARGE";

export const applyTheme = (
  theme: ThemeMode = "SYSTEM",
  fontScale: FontScale = "DEFAULT"
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
  try {
    const cached = localStorage.getItem("theme_pref");
    if (cached) {
      const { theme, fontScale } = JSON.parse(cached);
      applyTheme(theme, fontScale);
      return;
    }
  } catch {}
  applyTheme("SYSTEM", "DEFAULT");
};

// System theme listener for real-time OS mode sync
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    try {
      const cached = localStorage.getItem("theme_pref");
      if (cached) {
        const { theme, fontScale } = JSON.parse(cached);
        if (theme === "SYSTEM") {
          applyTheme("SYSTEM", fontScale);
        }
      } else {
        applyTheme("SYSTEM", "DEFAULT");
      }
    } catch {}
  });
}