import { useEffect, useRef, useState } from "react";
import { compressImageFile, MAX_IMAGES_PER_MESSAGE } from "../../../lib/image";

// Persisted recents so the card shows photos by default even after reload.
// Newest first (time order). Compressed dataURLs — cap count for quota safety.
const RECENTS_STORAGE_KEY = "chatapp.recents.images";
const MAX_STORED_RECENTS = 6;

const loadStoredRecents = (): string[] => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.startsWith("data:image"))
      .slice(0, MAX_STORED_RECENTS);
  } catch {
    return [];
  }
};

export const useComposerImages = () => {
  const [images, setImages] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>(() => loadStoredRecents());
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(
        RECENTS_STORAGE_KEY,
        JSON.stringify(recents.slice(0, MAX_STORED_RECENTS))
      );
    } catch {
      // Quota exceeded: retry with fewer items, else give up silently.
      try {
        window.localStorage.setItem(
          RECENTS_STORAGE_KEY,
          JSON.stringify(recents.slice(0, 3))
        );
      } catch {
        // ignore — recents just won't survive reload
      }
    }
  }, [recents]);

  const handleFiles = async (files: FileList | null) => {
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
      setRecents((prev) => [...compressed, ...prev.filter((r) => !compressed.includes(r))].slice(0, 12));
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

  return { images, compressing, fileInputRef, handleFiles, removeImage, clearImages, recents, attachRecent };
};

export type ComposerImages = ReturnType<typeof useComposerImages>;
