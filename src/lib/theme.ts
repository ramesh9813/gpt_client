export type ThemeMode = "SYSTEM" | "DARK" | "LIGHT";
export type FontScale = "SMALL" | "DEFAULT" | "LARGE";

export const applyTheme = (
  theme: ThemeMode = "SYSTEM",
  accentColor: string = "#74aa9c",
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
  if (accentColor) {
    root.style.setProperty("--accent", accentColor);
  }

  // Update theme-color meta tag for Android status bar and browser header
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", resolved === "dark" ? "#212121" : "#ffffff");
  }

  // Cache in localStorage for immediate sync before network API loads
  try {
    localStorage.setItem("theme_pref", JSON.stringify({ theme, accentColor, fontScale }));
  } catch {}
};

export const initTheme = () => {
  if (typeof window === "undefined") return;
  try {
    const cached = localStorage.getItem("theme_pref");
    if (cached) {
      const { theme, accentColor, fontScale } = JSON.parse(cached);
      applyTheme(theme, accentColor, fontScale);
      return;
    }
  } catch {}
  applyTheme("SYSTEM", "#74aa9c", "DEFAULT");
};

// System theme listener for real-time OS mode sync
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    try {
      const cached = localStorage.getItem("theme_pref");
      if (cached) {
        const { theme, accentColor, fontScale } = JSON.parse(cached);
        if (theme === "SYSTEM") {
          applyTheme("SYSTEM", accentColor, fontScale);
        }
      } else {
        applyTheme("SYSTEM", "#74aa9c", "DEFAULT");
      }
    } catch {}
  });
}