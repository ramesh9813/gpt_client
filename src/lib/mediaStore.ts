// Session-persistent bytes for sent audio/video attachments.
//
// The server keeps only file meta (name/mime/size), so playback bytes live
// here: IndexedDB (large quota, survives reloads) keyed by
// conversation + file identity. Never sent anywhere — playback only.

const DB_NAME = "chatapp-media";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

export const mediaKey = (conversationId: string, name: string, size: number): string =>
  `${conversationId}\n${name}\n${size}`;

const openDb = (): Promise<IDBDatabase | null> => {
  try {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          if (!req.result.objectStoreNames.contains(STORE_NAME)) {
            req.result.createObjectStore(STORE_NAME);
          }
        } catch {
          // ignore — store may already exist
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveMediaBlob = async (
  conversationId: string,
  name: string,
  size: number,
  blob: Blob
): Promise<void> => {
  if (!conversationId || !blob) return;
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("media save failed"));
        tx.objectStore(STORE_NAME).put(blob, mediaKey(conversationId, name, size));
      } catch (err) {
        reject(err);
      }
    });
  } catch {
    // Quota/private mode — playback just won't survive; chips still render.
  } finally {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
};

const readMediaBlob = async (
  conversationId: string,
  name: string,
  size: number
): Promise<Blob | null> => {
  const db = await openDb();
  if (!db) return null;
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const get = tx.objectStore(STORE_NAME).get(mediaKey(conversationId, name, size));
        get.onsuccess = () => {
          const v = get.result as Blob | null;
          resolve(v instanceof Blob ? v : null);
        };
        get.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return blob;
  } finally {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
};

// Object-URL cache: one URL per key, minted once, reused by every player.
const urlCache = new Map<string, string>();

export const getMediaUrl = async (
  conversationId: string,
  name: string,
  size: number
): Promise<string | null> => {
  if (!conversationId) return null;
  const key = mediaKey(conversationId, name, size);
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await readMediaBlob(conversationId, name, size);
  if (!blob) return null;
  try {
    const url = URL.createObjectURL(blob);
    urlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
};
