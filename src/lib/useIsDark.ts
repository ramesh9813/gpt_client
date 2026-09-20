import { useEffect, useState } from "react";

const readIsDark = (): boolean => {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.classList.contains("dark")) return true;
  const attr = root.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  if (typeof window !== "undefined" && typeof window.matchMedia !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
};

/** Tracks the app's effective dark mode (class + data-theme + system). */
export const useIsDark = (): boolean => {
  const [isDark, setIsDark] = useState<boolean>(() => readIsDark());

  useEffect(() => {
    setIsDark(readIsDark());
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    const mq =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const onMedia = () => setIsDark(readIsDark());
    mq?.addEventListener("change", onMedia);
    return () => {
      observer.disconnect();
      mq?.removeEventListener("change", onMedia);
    };
  }, []);

  return isDark;
};
