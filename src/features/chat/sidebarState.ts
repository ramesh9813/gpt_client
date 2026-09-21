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

// Last-open chat: instant restore on reload. Overwritten on every
// conversation switch so only the current chat is ever stored.
export const LAST_CONVERSATION_KEY = "chatapp.last.conversationId";

export const loadLastConversationId = (): string | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LAST_CONVERSATION_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
};

export const saveLastConversationId = (id: string): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (id && id.trim()) window.localStorage.setItem(LAST_CONVERSATION_KEY, id);
  } catch {
    // ignore write errors — restore just won't happen next load
  }
};

export const clearLastConversationId = (): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(LAST_CONVERSATION_KEY);
  } catch {
    // ignore
  }
};

// Web search stays ON by default for every input until explicitly turned
// off. The composer persists the globe toggle here; the send pipeline
// falls back to it whenever a turn carries no explicit flag (follow-up
// chips, quiz rounds, edits, regenerates).
export const WEBSEARCH_ARMED_KEY = "chatapp.websearch.armed";

export const readWebSearchArmed = (): boolean => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return true;
    const v = window.localStorage.getItem(WEBSEARCH_ARMED_KEY);
    return v === null ? true : v !== "false";
  } catch {
    return true;
  }
};
