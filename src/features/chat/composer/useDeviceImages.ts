import { useCallback, useEffect, useRef, useState } from "react";

// Device gallery (SD card) recents via the File System Access API.
// The user picks a folder once (e.g. DCIM or Pictures); the handle persists
// in IndexedDB so later opens re-check permission silently. Photos and
// screenshots split into two time-ordered rows (newest first).

export type DeviceImage = { url: string; name: string; modified: number };
export type DeviceStatus =
  | "unsupported"
  | "idle"
  | "loading"
  | "ready"
  | "denied";

const IDB_DB = "chatui-media";
const IDB_STORE = "handles";
const IDB_KEY = "photos-dir";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
const MAX_SCAN_FILES = 250;
const MAX_ROW_IMAGES = 10;

type DirHandle = {
  values: () => AsyncIterableIterator<{ kind: string; name: string; getFile?: () => Promise<File> }>;
  queryPermission?: (opts: { mode: string }) => Promise<string>;
  requestPermission?: (opts: { mode: string }) => Promise<string>;
};

const isSupported = (): boolean =>
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

const idbGetHandle = async (): Promise<DirHandle | null> => {
  try {
    const db = await openDb();
    const value: unknown = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const rq = tx.objectStore(IDB_STORE).get(IDB_KEY);
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

const idbSetHandle = async (handle: DirHandle): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const rq = tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      rq.onsuccess = () => resolve();
      rq.onerror = () => reject(rq.error);
    } catch (e) {
      reject(e);
    }
  });
  db.close();
};

type Found = { file: File; path: string };

const walkDir = async (
  dir: DirHandle,
  prefix: string,
  out: Found[],
  budget: { n: number },
  depth: number
): Promise<void> => {
  if (depth > 2 || budget.n <= 0) return;
  for await (const entry of dir.values()) {
    if (budget.n <= 0) return;
    try {
      if (entry.kind === "file" && IMAGE_EXT.test(entry.name)) {
        const file = await entry.getFile?.();
        if (file) {
          out.push({ file, path: `${prefix}/${entry.name}` });
          budget.n -= 1;
        }
      } else if (
        entry.kind === "directory" &&
        depth < 2 &&
        !entry.name.startsWith(".")
      ) {
        await walkDir(entry as unknown as DirHandle, `${prefix}/${entry.name}`, out, budget, depth + 1);
      }
    } catch {
      // unreadable entry — skip it
    }
  }
};

export const useDeviceImages = () => {
  const [status, setStatus] = useState<DeviceStatus>(() =>
    isSupported() ? "idle" : "unsupported"
  );
  const [photos, setPhotos] = useState<DeviceImage[]>([]);
  const [screenshots, setScreenshots] = useState<DeviceImage[]>([]);
  const urlsRef = useRef<string[]>([]);

  const revokeUrls = useCallback((urls: string[]) => {
    for (const u of urls) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const leftovers = urlsRef.current;
    return () => revokeUrls(leftovers);
  }, [revokeUrls]);

  const loadFromHandle = useCallback(
    async (dir: DirHandle) => {
      setStatus("loading");
      try {
        const found: Found[] = [];
        await walkDir(dir, "", found, { n: MAX_SCAN_FILES }, 0);
        found.sort((a, b) => b.file.lastModified - a.file.lastModified);

        const previous = urlsRef.current;
        urlsRef.current = [];
        const shots: DeviceImage[] = [];
        const pics: DeviceImage[] = [];
        for (const f of found) {
          const isShot = /screenshot/i.test(f.path);
          if (isShot && shots.length >= MAX_ROW_IMAGES) continue;
          if (!isShot && pics.length >= MAX_ROW_IMAGES) continue;
          let url: string;
          try {
            url = URL.createObjectURL(f.file);
          } catch {
            continue;
          }
          urlsRef.current.push(url);
          const img = { url, name: f.file.name, modified: f.file.lastModified };
          if (isShot) shots.push(img);
          else pics.push(img);
          if (shots.length >= MAX_ROW_IMAGES && pics.length >= MAX_ROW_IMAGES) break;
        }
        revokeUrls(previous);
        setPhotos(pics);
        setScreenshots(shots);
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    },
    [revokeUrls]
  );

  // Silent path: only loads when a stored handle already has permission.
  // Never prompts — the Allow button is the only prompter.
  const ensureSilent = useCallback(async () => {
    if (!isSupported() || status === "ready" || status === "loading") return;
    const handle = await idbGetHandle();
    if (!handle) return;
    try {
      const q = await handle.queryPermission?.({ mode: "read" });
      if (q === "granted") await loadFromHandle(handle);
    } catch {
      // stay idle — user can tap Allow
    }
  }, [loadFromHandle, status]);

  const pickFolder = useCallback(async () => {
    if (!isSupported()) return;
    try {
      const dir = (await (
        window as unknown as {
          showDirectoryPicker: (opts: Record<string, unknown>) => Promise<DirHandle>;
        }
      ).showDirectoryPicker({
        id: "chatui-photos",
        mode: "read",
        startIn: "pictures",
      })) as DirHandle;
      const granted = await dir.requestPermission?.({ mode: "read" });
      if (granted !== "granted") {
        setStatus("denied");
        return;
      }
      try {
        await idbSetHandle(dir);
      } catch {
        // handle just won't persist — session still works
      }
      await loadFromHandle(dir);
    } catch (e) {
      // AbortError = user cancelled the picker: stay idle.
      if ((e as { name?: string })?.name === "AbortError") return;
      setStatus("denied");
    }
  }, [loadFromHandle]);

  return {
    devicePhotos: photos,
    deviceScreenshots: screenshots,
    deviceStatus: status,
    ensureSilent,
    pickFolder,
  };
};

export type DeviceImagesApi = ReturnType<typeof useDeviceImages>;
