// Two-step load cache: Step 1 = instant paint from localStorage,
// Step 2 = background DB refresh overwrites cache.
//
// localStorage is synchronous, so reading it in useState initializers lets
// the UI shell + last chat render on the very first frame with zero network.
// Writes are best-effort (quota / private mode safe).

import type { ChatMessage } from "./message/types";
import type { Conversation, Folder } from "./sidebar/types";

const CONVERSATIONS_KEY = "chatapp.cache.conversations";
const FOLDERS_KEY = "chatapp.cache.folders";
const ME_KEY = "chatapp.cache.me";
const MSG_PREFIX = "chatapp.cache.messages.";
const MSG_INDEX_KEY = "chatapp.cache.messages.index";

const MAX_CACHED_MESSAGES = 100;
const MAX_CACHED_CONVERSATIONS = 200;

function safeRead<T>(key: string): T | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode: evict oldest message cache and retry once.
    try {
      evictOldestMessageCache();
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Last resort: drop message caches entirely so small keys still work.
      try {
        clearAllMessageCaches();
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore — cache is optional
      }
    }
  }
}

// --- Messages ---------------------------------------------------------------

// Base64 vision images (data:...) can be ~7MB each and blow the ~5MB
// localStorage quota instantly. Strip them for cache; text/quiz/followups
// (the expensive-to-refetch part) still paints instantly.
function sanitizeForCache(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => !String(m.id || "").startsWith("local-"))
    .filter((m) => (m.status || "COMPLETE") !== "STREAMING" || (m.content || "").length > 0)
    .slice(-MAX_CACHED_MESSAGES)
    .map((m) => {
      const out: ChatMessage = { ...m };
      if (Array.isArray(out.images)) {
        out.images = out.images.filter(
          (u) => typeof u === "string" && !u.startsWith("data:image/")
        );
        if (out.images.length === 0) delete (out as { images?: unknown }).images;
      }
      if (Array.isArray(out.videos)) {
        out.videos = out.videos.filter(
          (u) => typeof u === "string" && !u.startsWith("data:")
        );
        if (out.videos.length === 0) delete (out as { videos?: unknown }).videos;
      }
      // Reasoning can be long; keep it (needed for research turns) but cap.
      if (typeof out.reasoning === "string" && out.reasoning.length > 20000) {
        out.reasoning = out.reasoning.slice(0, 20000);
      }
      if (typeof out.content === "string" && out.content.length > 50000) {
        out.content = out.content.slice(0, 50000);
      }
      return out;
    });
}

const msgKey = (conversationId: string) => `${MSG_PREFIX}${conversationId}`;

function touchMessageIndex(conversationId: string): void {
  try {
    const raw = window.localStorage.getItem(MSG_INDEX_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [conversationId, ...list.filter((id) => id !== conversationId)].slice(0, 20);
    window.localStorage.setItem(MSG_INDEX_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function evictOldestMessageCache(): void {
  try {
    const raw = window.localStorage.getItem(MSG_INDEX_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const oldest = list[list.length - 1];
    if (oldest) {
      window.localStorage.removeItem(msgKey(oldest));
      window.localStorage.setItem(MSG_INDEX_KEY, JSON.stringify(list.slice(0, -1)));
    }
  } catch {
    // ignore
  }
}

function clearAllMessageCaches(): void {
  try {
    const raw = window.localStorage.getItem(MSG_INDEX_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    list.forEach((id) => {
      try {
        window.localStorage.removeItem(msgKey(id));
      } catch {
        // ignore
      }
    });
    window.localStorage.removeItem(MSG_INDEX_KEY);
  } catch {
    // ignore
  }
}

export function readCachedMessages(conversationId: string | null | undefined): ChatMessage[] | null {
  if (!conversationId) return null;
  const cached = safeRead<ChatMessage[]>(msgKey(conversationId));
  if (!Array.isArray(cached) || cached.length === 0) return null;
  return cached;
}

export function writeCachedMessages(
  conversationId: string | null | undefined,
  messages: ChatMessage[]
): void {
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) return;
  // Don't cache mid-stream placeholders with temp ids only.
  const clean = sanitizeForCache(messages);
  if (clean.length === 0) return;
  safeWrite(msgKey(conversationId), clean);
  touchMessageIndex(conversationId);
}

export function clearCachedMessages(conversationId: string): void {
  try {
    window.localStorage.removeItem(msgKey(conversationId));
  } catch {
    // ignore
  }
}

// --- Conversations / folders -------------------------------------------------

export function readCachedConversations(): Conversation[] | null {
  const cached = safeRead<Conversation[]>(CONVERSATIONS_KEY);
  if (!Array.isArray(cached) || cached.length === 0) return null;
  return cached;
}

export function writeCachedConversations(items: Conversation[]): void {
  if (!Array.isArray(items)) return;
  safeWrite(CONVERSATIONS_KEY, items.slice(0, MAX_CACHED_CONVERSATIONS));
}

export function readCachedFolders(): Folder[] | null {
  const cached = safeRead<Folder[]>(FOLDERS_KEY);
  if (!Array.isArray(cached)) return null;
  return cached;
}

export function writeCachedFolders(items: Folder[]): void {
  if (!Array.isArray(items)) return;
  safeWrite(FOLDERS_KEY, items);
}

// --- Auth user (for non-blocking shell) --------------------------------------

export type CachedMeUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
};

export function readCachedMeUser(): CachedMeUser | null {
  const cached = safeRead<CachedMeUser>(ME_KEY);
  if (!cached || typeof cached !== "object" || !cached.email) return null;
  return cached;
}

export function writeCachedMeUser(user: CachedMeUser | null | undefined): void {
  if (!user || typeof user !== "object" || !user.email) return;
  safeWrite(ME_KEY, { id: user.id, email: user.email, name: user.name ?? null, role: user.role });
}

export function clearCachedMeUser(): void {
  try {
    window.localStorage.removeItem(ME_KEY);
  } catch {
    // ignore
  }
}
