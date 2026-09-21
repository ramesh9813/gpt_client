export type DeviceFolderKind = "photos" | "screenshots";

export type DirEntry = {
  kind: string;
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterableIterator<DirEntry>;
};

export type DirHandle = {
  name?: string;
  values?: () => AsyncIterableIterator<DirEntry>;
  entries?: () => AsyncIterableIterator<[string, DirEntry]>;
  queryPermission?: (opts: { mode: string }) => Promise<string>;
  requestPermission?: (opts: { mode: string }) => Promise<string>;
};

const IDB_DB = "chatui-media";
const IDB_STORE = "handles";
const HANDLE_KEYS: Record<DeviceFolderKind, string> = {
  photos: "photos-dir",
  screenshots: "shots-dir",
};

export const isSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker === "function" &&
  typeof indexedDB !== "undefined";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });

export const idbGetHandle = async (kind: DeviceFolderKind): Promise<DirHandle | null> => {
  try {
    const db = await openDb();
    const value: unknown = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const rq = tx.objectStore(IDB_STORE).get(HANDLE_KEYS[kind]);
        rq.onsuccess = () => resolve(rq.result ?? null);
        rq.onerror = () => reject(rq.error);
      } catch (e) {
        reject(e);
      }
    });
    db.close();
    return (value as DirHandle | null) ?? null;
  } catch {
    return null;
  }
};

export const idbSetHandle = async (kind: DeviceFolderKind, handle: DirHandle): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const rq = tx.objectStore(IDB_STORE).put(handle, HANDLE_KEYS[kind]);
      rq.onsuccess = () => resolve();
      rq.onerror = () => reject(rq.error);
    } catch (e) {
      reject(e);
    }
  });
  db.close();
};
