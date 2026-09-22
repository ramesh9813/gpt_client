import { useCallback, useEffect, useRef, useState } from "react";
import {
  idbGetHandle,
  idbSetHandle,
  isSupported,
  type DeviceFolderKind,
  type DirHandle,
} from "./deviceDb";
import {
  MAX_ROW_IMAGES,
  MAX_SCAN_FILES,
  isScreenshotFound,
  walkDir,
  type Found,
} from "./deviceScan";
import { loadDeviceMeta, saveDeviceMeta } from "./deviceMeta";

export type { DeviceFolderKind, DirHandle, Found };
export { isSupported };

// Device gallery (SD card) recents via the File System Access API.
// Two folders can be granted independently: one for camera photos, one for
// screenshots. Handles persist in IndexedDB so later opens re-check
// permission silently. Both folders feed time-ordered rows (newest first);
// screenshot-like paths always land in the screenshots row.
// Preloads silently in the background on app load (no tap needed) so the
// rows are ready the moment the user opens the image card. Reads stay
// strictly local (blob: URLs + name/order meta) — images are never
// uploaded, never sent to the server, never written to the database.

export type DeviceImage = { url: string; name: string; modified: number };
export type DeviceStatus =
  | "unsupported"
  | "idle"
  | "loading"
  | "ready"
  | "denied";

export const useDeviceImages = () => {
  const [status, setStatus] = useState<DeviceStatus>(() =>
    isSupported() ? "idle" : "unsupported"
  );
  const [photos, setPhotos] = useState<DeviceImage[]>([]);
  const [screenshots, setScreenshots] = useState<DeviceImage[]>([]);
  // Instant folder labels from the cached snapshot: rows show the saved
  // folder (name + count) on first paint, before the background rescan
  // finishes — no waiting, no repeated permission prompts.
  const [photoFolderName, setPhotoFolderName] = useState<string | null>(
    () => loadDeviceMeta("photos")?.folderName ?? null
  );
  const [shotsFolderName, setShotsFolderName] = useState<string | null>(
    () => loadDeviceMeta("screenshots")?.folderName ?? null
  );
  // Visible diagnostics: files scanned per folder, so an empty row explains
  // itself instead of failing silently. Seeded from cache for instant paint.
  const [scanInfo, setScanInfo] = useState<
    Record<DeviceFolderKind, { folder: string; scanned: number } | null>
  >(() => {
    const photosMeta = loadDeviceMeta("photos");
    const shotsMeta = loadDeviceMeta("screenshots");
    return {
      photos: photosMeta
        ? { folder: photosMeta.folderName, scanned: photosMeta.scanned }
        : null,
      screenshots: shotsMeta
        ? { folder: shotsMeta.folderName, scanned: shotsMeta.scanned }
        : null,
    };
  });
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
    // Latest first: newest lastModified at index 0. File names (camera /
    // screenshot counters) break ties when timestamps are equal or missing,
    // so the latest capture always leads the row.
    all.sort(
      (a, b) =>
        b.file.lastModified - a.file.lastModified ||
        (b.file.name > a.file.name ? 1 : b.file.name < a.file.name ? -1 : 0)
    );
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
    // LOCAL-ONLY: reads files from the granted directory into memory +
    // blob: URLs for instant rows. Never uploads, never POSTs, never writes
    // image bytes anywhere — only name/path/order meta goes to localStorage.
    async (kind: DeviceFolderKind, dir: DirHandle, skipRebuild = false) => {
      const found: Found[] = [];
      await walkDir(dir, kind, "", found, { n: MAX_SCAN_FILES }, 0);
      sourcesRef.current[kind] = found;
      const folder = dir.name || (kind === "photos" ? "camera folder" : "screenshots folder");
      if (kind === "photos") setPhotoFolderName(dir.name ?? null);
      else setShotsFolderName(dir.name ?? null);
      setScanInfo((prev) => ({ ...prev, [kind]: { folder, scanned: found.length } }));
      // Persist name + order for instant next-load paint.
      saveDeviceMeta(
        kind,
        folder,
        found.map((f) => ({
          name: f.file.name,
          path: f.path,
          modified: f.file.lastModified,
          size: f.file.size,
        }))
      );
      if (!skipRebuild) rebuildRows();
    },
    [rebuildRows]
  );

  // Auto-load path for granted folders. Runs silently at mount AND on
  // card open. When opened from a real tap (fromGesture), a dormant grant
  // may be re-confirmed via requestPermission without re-picking folders,
  // so every reload reopens straight into loaded rows.
  // Background preload: both folders scan IN PARALLEL, latest-first, with a
  // single row rebuild at the end — ready before the user taps the image
  // icon. Purely local reads; nothing is uploaded or sent anywhere.
  const ensureDeviceImages = useCallback(
    async (fromGesture: boolean) => {
      if (!isSupported() || status === "ready" || status === "loading") return;
      setStatus("loading");
      try {
        const kinds = ["photos", "screenshots"] as DeviceFolderKind[];
        const results = await Promise.all(
          kinds.map(async (kind) => {
            const handle = await idbGetHandle(kind);
            if (!handle) return false;
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
                await scanFolder(kind, handle, true);
                return true;
              }
            } catch {
              // ignore this handle
            }
            return false;
          })
        );
        rebuildRows();
        const loadedAny =
          results.some(Boolean) ||
          sourcesRef.current.photos.length + sourcesRef.current.screenshots.length > 0;
        setStatus(loadedAny ? "ready" : "idle");
      } catch {
        setStatus("idle");
      }
    },
    [rebuildRows, scanFolder, status]
  );

  // Manual refresh from the per-row button: re-scans the already-granted
  // stored handles (camera + screenshots) without opening the folder
  // picker, so new captures appear immediately, latest first. Never
  // prompts for a new folder — missing handles are simply skipped.
  // Local reads only; nothing is uploaded or sent anywhere.
  const refreshDeviceImages = useCallback(
    async (kind?: DeviceFolderKind) => {
      if (!isSupported()) return;
      setStatus("loading");
      try {
        const kinds = kind ? [kind] : (["photos", "screenshots"] as DeviceFolderKind[]);
        const results = await Promise.all(
          kinds.map(async (k) => {
            const handle = await idbGetHandle(k);
            if (!handle) return false;
            try {
              let q =
                typeof handle.queryPermission === "function"
                  ? await handle.queryPermission({ mode: "read" })
                  : "granted";
              // Refresh comes from a tap: transient activation lets a dormant
              // grant re-confirm via the permission chip — still no re-pick.
              if (
                q !== "granted" &&
                typeof handle.requestPermission === "function"
              ) {
                q = await handle.requestPermission({ mode: "read" });
              }
              if (q === "granted") {
                await scanFolder(k, handle, true);
                return true;
              }
            } catch {
              // ignore this handle
            }
            return false;
          })
        );
        rebuildRows();
        const loadedAny =
          results.some(Boolean) ||
          sourcesRef.current.photos.length + sourcesRef.current.screenshots.length > 0;
        setStatus(loadedAny ? "ready" : "idle");
      } catch {
        setStatus("idle");
      }
    },
    [rebuildRows, scanFolder]
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
    refreshDeviceImages,
  };
};

export type DeviceImagesApi = ReturnType<typeof useDeviceImages>;
