import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./types";

export const useMessageEdit = (
  onEditSubmit?: (id: string, value: string, images?: string[]) => Promise<void>
) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [editingError, setEditingError] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => editRef.current?.focus());
  }, [editingId]);

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditingValue(message.content);
    setEditingImages(message.images ? [...message.images] : []);
    setEditingError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
    setEditingImages([]);
    setEditingError(null);
  };

  const removeEditingImage = (index: number) => {
    setEditingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const submitEdit = async () => {
    if (!editingId || !onEditSubmit) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingError("Message cannot be empty");
      return;
    }
    // Immediate send: close the editor at once (no "Saving..." state — the
    // retried answer streams below like a normal send). On failure the draft
    // is restored with the error so nothing is silently lost.
    const id = editingId;
    const value = trimmed;
    const images = editingImages;
    setEditingId(null);
    setEditingValue("");
    setEditingImages([]);
    setEditingError(null);
    try {
      await onEditSubmit(id, value, images);
    } catch (err: any) {
      setEditingId(id);
      setEditingValue(value);
      setEditingImages(images);
      setEditingError(err?.message || "Failed to update message");
    }
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  return {
    editingId,
    editingValue,
    setEditingValue,
    editingImages,
    removeEditingImage,
    editingError,
    editRef,
    startEdit,
    cancelEdit,
    submitEdit,
    onEditKeyDown
  };
};

export type MessageEdit = ReturnType<typeof useMessageEdit>;
