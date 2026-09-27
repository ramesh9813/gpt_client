import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./types";

export const useMessageEdit = (
  onEditSubmit?: (id: string, value: string, images?: string[]) => Promise<void>
) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [editingError, setEditingError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
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
    setEditingError(null);
    setSavingId(editingId);
    try {
      await onEditSubmit(editingId, trimmed, editingImages);
      setEditingId(null);
      setEditingValue("");
      setEditingImages([]);
    } catch (err: any) {
      setEditingError(err?.message || "Failed to update message");
    } finally {
      setSavingId(null);
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
    savingId,
    editRef,
    startEdit,
    cancelEdit,
    submitEdit,
    onEditKeyDown
  };
};

export type MessageEdit = ReturnType<typeof useMessageEdit>;
