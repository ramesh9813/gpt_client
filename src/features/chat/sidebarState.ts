export type SidebarState = "expanded" | "collapsed" | "hidden";

export const SIDEBAR_STORAGE_KEY = "chatapp.sidebar.state";

export const isSidebarState = (value: unknown): value is SidebarState =>
  value === "expanded" || value === "collapsed" || value === "hidden";

export const loadSidebarState = (): SidebarState => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "expanded";
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (isSidebarState(raw)) {
      // Laptop behavior: minimize fully hides (no 56px rail step).
      // Migrate any persisted collapsed state to hidden.
      if (raw === "collapsed") return "hidden";
      return raw;
    }
  } catch {
    // ignore storage errors (private mode, etc.) and fall back to default
  }
  return "expanded";
};

export const saveSidebarState = (state: SidebarState): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // ignore write errors — sidebar still works for the session
  }
};
