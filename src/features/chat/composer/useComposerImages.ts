import { useEffect, useRef, useState } from "react";
import { compressImageFile, MAX_IMAGES_PER_MESSAGE } from "../../../lib/image";

// Persisted recents so the card shows photos by default even after reload.
// Newest first (time order), split into camera/picked photos vs pasted
// screenshots. Compressed dataURLs — cap count for quota safety.
const PHOTOS_STORAGE_KEY = "chatapp.recents.photos";
const SCREENSHOTS_STORAGE_KEY = "chatapp.recents.screenshots";
const LEGACY_RECENTS_KEY = "chatapp.recents.images";
const MAX_STORED_RECENTS = 6;
const MAX_MEMORY_RECENTS = 12;

export type RecentKind = "photo" | "screenshot";

const cleanStored = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.startsWith("data:image"))
      .slice(0, MAX_STORED_RECENTS);
  } catch {
    return [];
  }
};

const loadStoredList = (key: string, legacyFallback: boolean): string[] => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const own = cleanStored(window.localStorage.getItem(key));
    if (own.length > 0 || !legacyFallback) return own;
    // One-time migration from the old single-list key.
    return cleanStored(window.localStorage.getItem(LEGACY_RECENTS_KEY));
  } catch {
    return [];
  }
};

const persistList = (key: string, list: string[]) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_STORED_RECENTS)));
  } catch {
    // Quota exceeded: retry with fewer items, else give up silently.
    try {
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 3)));
    } catch {
      // ignore — recents just won't survive reload
    }
  }
};

const prependUnique = (prev: string[], fresh: string[]): string[] =>
  [...fresh, ...prev.filter((r) => !fresh.includes(r))].slice(0, MAX_MEMORY_RECENTS);

export const useComposerImages = () => {
  const [images, setImages] = useState<string[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<string[]>(() =>
    loadStoredList(PHOTOS_STORAGE_KEY, true)
  );
  const [recentScreenshots, setRecentScreenshots] = useState<string[]>(() =>
    loadStoredList(SCREENSHOTS_STORAGE_KEY, false)
  );
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    persistList(PHOTOS_STORAGE_KEY, recentPhotos);
  }, [recentPhotos]);

  useEffect(() => {
    persistList(SCREENSHOTS_STORAGE_KEY, recentScreenshots);
  }, [recentScreenshots]);

  const handleFiles = async (files: FileList | null, kind: RecentKind = "photo") => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;
    setCompressing(true);
    try {
      const room = Math.max(0, MAX_IMAGES_PER_MESSAGE - images.length);
      const slice = picked.slice(0, room);
      const compressed = await Promise.all(
        slice.map((f) => compressImageFile(f, 1280, 0.8))
      );
      setImages((prev) => [...prev, ...compressed].slice(0, MAX_IMAGES_PER_MESSAGE));
      if (kind === "screenshot") {
        setRecentScreenshots((prev) => prependUnique(prev, compressed));
      } else {
        setRecentPhotos((prev) => prependUnique(prev, compressed));
      }
    } catch {
      // Silently ignore failed decodes; caller can retry with another file.
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const attachRecent = (src: string) => {
    setImages((prev) => {
      if (prev.includes(src) || prev.length >= MAX_IMAGES_PER_MESSAGE) return prev;
      return [...prev, src];
    });
  };

  return {
    images,
    compressing,
    fileInputRef,
    handleFiles,
    removeImage,
    clearImages,
    recentPhotos,
    recentScreenshots,
    attachRecent,
  };
};

export type ComposerImages = ReturnType<typeof useComposerImages>;
