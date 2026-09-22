import type { DeviceFolderKind } from "./deviceDb";

// Cached folder snapshot so rows show instantly on reload: folder name,
// scan count, and file name/path/order. Blob URLs can't persist, so this
// stores identity + order only (small, quota-safe); the background rescan
// re-attaches URLs in the same order.

export type DeviceFileMeta = {
  name: string;
  path: string;
  modified: number;
  size: number;
};

export type DeviceFolderMeta = {
  folderName: string;
  scanned: number;
  savedAt: number;
  files: DeviceFileMeta[];
};

const META_KEYS: Record<DeviceFolderKind, string> = {
  photos: "chatapp.device.photos.meta",
  screenshots: "chatapp.device.screenshots.meta",
};

const MAX_META_FILES = 50;

const isValidMeta = (value: unknown): value is DeviceFolderMeta => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.folderName === "string" &&
    typeof v.scanned === "number" &&
    Array.isArray(v.files)
  );
};

export const loadDeviceMeta = (kind: DeviceFolderKind): DeviceFolderMeta | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(META_KEYS[kind]);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidMeta(parsed)) return null;
    return {
      folderName: parsed.folderName,
      scanned: parsed.scanned,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
      files: parsed.files
        .filter(
          (f): f is DeviceFileMeta =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as DeviceFileMeta).name === "string"
        )
        .slice(0, MAX_META_FILES),
    };
  } catch {
    return null;
  }
};

export const saveDeviceMeta = (
  kind: DeviceFolderKind,
  folderName: string,
  files: DeviceFileMeta[]
): void => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const meta: DeviceFolderMeta = {
      folderName,
      scanned: files.length,
      savedAt: Date.now(),
      files: files.slice(0, MAX_META_FILES),
    };
    window.localStorage.setItem(META_KEYS[kind], JSON.stringify(meta));
  } catch {
    // quota or unavailable — meta just won't survive reload
  }
};

export const clearDeviceMeta = (kind: DeviceFolderKind): void => {
  try {
    window.localStorage?.removeItem(META_KEYS[kind]);
  } catch {
    // ignore
  }
};
