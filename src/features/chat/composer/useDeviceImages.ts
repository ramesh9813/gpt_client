import { useCallback, useEffect, useRef, useState } from "react";

// Device gallery (SD card) recents via the File System Access API.
// Two folders can be granted independently: one for camera photos, one for
// screenshots. Handles persist in IndexedDB so later opens re-check
// permission silently. Both folders feed time-ordered rows (newest first);
// screenshot-like paths always land in the screenshots row.

export type DeviceImage = { url: string; name: string; modified: number };
export type DeviceStatus =
  | "unsupported"
  | "idle"
  | "loading"
  | "ready"
  | "denied";
export type DeviceFolderKind = "photos" | "screenshots";

const IDB_DB = "chatui-media";
const IDB_STORE = "handles";
const HANDLE_KEYS: Record<DeviceFolderKind, string> = {
  photos: "photos-dir",
  screenshots: "shots-dir",
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
const MAX_SCAN_FILES = 250;
const MAX_ROW_IMAGES = 10;

type DirEntry = {
  kind: string;
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterableIterator<DirEntry>;
};

type DirHandle = {
  name?: string;
  values?: () => AsyncIterableIterator<DirEntry>;
  entries?: () => AsyncIterableIterator<[string, DirEntry]>;
  queryPermission?: (opts: { mode: string }) => Promise<string>;
  requestPermission?: (opts: { mode: string }) => Promise<string>;
};

// values() → entries() → async-iterator fallback: implementations differ.
async function* iterateEntries(dir: DirHandle): AsyncGenerator<DirEntry> {
  if (typeof dir.values === "function") {
    for await (const entry of dir.values()) yield entry;
    return;
  }
  if (typeof dir.entries === "function") {
    for await (const [, handle] of dir.entries()) yield handle;
    return;
  }
  const iterable = dir as unknown as {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<[string, DirEntry]>;
  };
  if (typeof iterable[Symbol.asyncIterator] === "function") {
    for await (const [, handle] of iterable[Symbol.asyncIterator]?.() ?? []) yield handle;
  }
}

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

const idbGetHandle = async (kind: DeviceFolderKind): Promise<DirHandle | null> => {
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

const idbSetHandle = async (kind: DeviceFolderKind, handle: DirHandle): Promise<void> => {
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

type Found = { file: File; path: string; kind: DeviceFolderKind };

const walkDir = async (
  dir: DirHandle,
  kind: DeviceFolderKind,
  prefix: string,
  out: Found[],
  budget: { n: number },
  depth: number
): Promise<void> => {
  if (depth > 3 || budget.n <= 0) return;
  for await (const entry of iterateEntries(dir)) {
    if (budget.n <= 0) return;
    try {
      if (entry.kind === "file" && IMAGE_EXT.test(entry.name)) {
        const file = await entry.getFile?.();
        if (file) {
          out.push({ file, path: `${prefix}/${entry.name}`, kind });
          budget.n -= 1;
        }
      } else if (
        entry.kind === "directory" &&
        depth < 3 &&
        !entry.name.startsWith(".")
      ) {
        await walkDir(entry as unknown as DirHandle, kind, `${prefix}/${entry.name}`, out, budget, depth + 1);
      }
    } catch {
      // unreadable entry — skip it
    }
  }
};

// Row rule: the screenshots-folder pick always lands in the screenshots row;
// everywhere else, screenshot-like paths do. Both rows stay newest-first.
const isScreenshotFound = (f: Found): boolean =>
  f.kind === "screenshots" || /screenshot/i.test(f.path);

export const useDeviceImages = () => {
  const [status, setStatus] = useState<DeviceStatus>(() =>
    isSupported() ? "idle" : "unsupported"
  );
  const [photos, setPhotos] = useState<DeviceImage[]>([]);
  const [screenshots, setScreenshots] = useState<DeviceImage[]>([]);
  const [photoFolderName, setPhotoFolderName] = useState<string | null>(null);
  const [shotsFolderName, setShotsFolderName] = useState<string | null>(null);
  // Visible diagnostics: files scanned per folder, so an empty row explains
  // itself instead of failing silently.
  const [scanInfo, setScanInfo] = useState<
    Record<DeviceFolderKind, { folder: string; scanned: number } | null>
  >({ photos: null, screenshots: null });
  const urlsRef = useRef<string[]>([]);
  // Per-folder scan results so granting a second folder unions with the
  // first instead of replacing it.
  const sourcesRef = useRef<Record<DeviceFolderKind, Found[]>>({
    photos: [],
    screenshots: [],
  });

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

  const rebuildRows = useCallback(() => {
    const all = [...sourcesRef.current.photos, ...sourcesRef.current.screenshots];
    all.sort((a, b) => b.file.lastModified - a.file.lastModified);
    const previous = urlsRef.current;
    urlsRef.current = [];
    const shots: DeviceImage[] = [];
    const pics: DeviceImage[] = [];
    for (const f of all) {
      const isShot = isScreenshotFound(f);
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
  }, [revokeUrls]);

  const scanFolder = useCallback(
    async (kind: DeviceFolderKind, dir: DirHandle) => {
      const found: Found[] = [];
      await walkDir(dir, kind, "", found, { n: MAX_SCAN_FILES }, 0);
      sourcesRef.current[kind] = found;
      const folder = dir.name || (kind === "photos" ? "camera folder" : "screenshots folder");
      if (kind === "photos") setPhotoFolderName(dir.name ?? null);
      else setShotsFolderName(dir.name ?? null);
      setScanInfo((prev) => ({ ...prev, [kind]: { folder, scanned: found.length } }));
      rebuildRows();
    },
    [rebuildRows]
  );

  // Auto-load path for granted folders. Runs silently at mount AND on
  // card open. When opened from a real tap (fromGesture), a dormant grant
  // may be re-confirmed via requestPermission without re-picking folders,
  // so every reload reopens straight into loaded rows.
  const ensureDeviceImages = useCallback(
    async (fromGesture: boolean) => {
      if (!isSupported() || status === "ready" || status === "loading") return;
      setStatus("loading");
      try {
        let loadedAny =
          sourcesRef.current.photos.length + sourcesRef.current.screenshots.length > 0;
        for (const kind of ["photos", "screenshots"] as DeviceFolderKind[]) {
          const handle = await idbGetHandle(kind);
          if (!handle) continue;
          try {
            // No queryPermission API = older grant model: the stored handle
            // itself implies access, so try the scan.
            let q =
              typeof handle.queryPermission === "function"
                ? await handle.queryPermission({ mode: "read" })
                : "granted";
            // Card opens from a tap: transient activation lets us
            // re-confirm a dormant grant with just the permission chip —
            // no folder re-pick needed.
            if (
              q !== "granted" &&
              fromGesture &&
              typeof handle.requestPermission === "function"
            ) {
              q = await handle.requestPermission({ mode: "read" });
            }
            if (q === "granted") {
              await scanFolder(kind, handle);
              loadedAny = true;
            }
          } catch {
            // ignore this handle
          }
        }
        setStatus(loadedAny ? "ready" : "idle");
      } catch {
        setStatus("idle");
      }
    },
    [scanFolder, status]
  );

  const pickFolder = useCallback(
    async (kind: DeviceFolderKind) => {
      if (!isSupported()) return;
      setStatus("loading");
      try {
        const dir = (await (
          window as unknown as {
            showDirectoryPicker: (opts: Record<string, unknown>) => Promise<DirHandle>;
          }
        ).showDirectoryPicker({
          id: `chatui-${kind}`,
          mode: "read",
          startIn: "pictures",
        })) as DirHandle;
        // No requestPermission API = the picker grant itself suffices.
        const granted =
          typeof dir.requestPermission === "function"
            ? await dir.requestPermission({ mode: "read" })
            : "granted";
        if (granted !== "granted") {
          setStatus(sourcesRef.current.photos.length + sourcesRef.current.screenshots.length > 0 ? "ready" : "denied");
          return;
        }
        try {
          await idbSetHandle(kind, dir);
        } catch {
          // handle just won't persist — session still works
        }
        await scanFolder(kind, dir);
        setStatus("ready");
      } catch (e) {
        // AbortError = user cancelled the picker: keep previous state.
        if ((e as { name?: string })?.name === "AbortError") {
          setStatus(sourcesRef.current.photos.length + sourcesRef.current.screenshots.length > 0 ? "ready" : "idle");
          return;
        }
        setStatus("denied");
      }
    },
    [scanFolder]
  );

  return {
    devicePhotos: photos,
    deviceScreenshots: screenshots,
    deviceStatus: status,
    photoFolderName,
    shotsFolderName,
    scanInfo,
    ensureSilent: ensureDeviceImages,
    ensureDeviceImages,
    pickFolder,
  };
};

export type DeviceImagesApi = ReturnType<typeof useDeviceImages>;
