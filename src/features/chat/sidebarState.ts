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

// Web search stays OFF by default — only an explicit tap on the model's
// Web Search row arms it. The choice persists here; the send pipeline
// falls back to it whenever a turn carries no explicit flag (follow-up
// chips, quiz rounds, edits, regenerates).
export const WEBSEARCH_ARMED_KEY = "chatapp.websearch.armed";

// One-time migration marker: the old default was ON and auto-persisted, so
// a stored "true" is usually not an explicit choice. First read after this
// change resets everyone to OFF once; later taps persist normally.
const WEBSEARCH_DEFAULT_OFF_MARK = "chatapp.websearch.defaultOff.v1";

export const readWebSearchArmed = (): boolean => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    if (!window.localStorage.getItem(WEBSEARCH_DEFAULT_OFF_MARK)) {
      window.localStorage.setItem(WEBSEARCH_ARMED_KEY, "false");
      window.localStorage.setItem(WEBSEARCH_DEFAULT_OFF_MARK, "1");
      return false;
    }
    return window.localStorage.getItem(WEBSEARCH_ARMED_KEY) === "true";
  } catch {
    return false;
  }
};

// Auto-trim history: ON by default. When a turn is near the provider's
// input limit, the client sends compactHistory so the server clamps to the
// emergency budget instead of 413ing. Persists like the other armed modes.
export const TRIM_ARMED_KEY = "chatapp.trim.armed";

export const readTrimArmed = (): boolean => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return true;
    const raw = window.localStorage.getItem(TRIM_ARMED_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
};
