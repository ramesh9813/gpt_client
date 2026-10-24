import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCanvasData } from "../canvas";
import type { FileViewData } from "../canvas/FileViewer";
import type { ChatMessage } from "../MessageList";

// Canvas opens ONLY on explicit user action (header button, swipe, or a
// clicked file chip). It never auto-opens, even when a response contains
// code. Close is animated: `closing` plays the slide/fade-out, then the
// panel unmounts.
const CLOSE_ANIMATION_MS = 250;

export const useChatCanvas = (messages: ChatMessage[]) => {
  const canvasData = useMemo(() => buildCanvasData(messages), [messages]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasDismissed, setCanvasDismissed] = useState(false);
  const [canvasClosing, setCanvasClosing] = useState(false);
  // File viewer: a clicked chat file chip opens the panel with this file
  // instead of code blocks. Cleared on close; a new click replaces it.
  const [fileView, setFileView] = useState<FileViewData | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (canvasData.blocks.length === 0 && !fileView) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setShowCanvas(false);
      setCanvasClosing(false);
      setCanvasDismissed(false);
    }
  }, [canvasData.blocks.length, fileView]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const openCanvas = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setCanvasClosing(false);
    setShowCanvas(true);
    setCanvasDismissed(false);
  }, []);

  const openFile = useCallback((file: FileViewData) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setCanvasClosing(false);
    setFileView(file);
    setShowCanvas(true);
    setCanvasDismissed(false);
  }, []);

  const closeCanvas = useCallback(() => {
    setCanvasDismissed(true);
    setCanvasClosing(true);
    setFileView(null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setShowCanvas(false);
      setCanvasClosing(false);
    }, CLOSE_ANIMATION_MS);
  }, []);

  return {
    canvasData,
    showCanvas,
    setShowCanvas,
    canvasDismissed,
    setCanvasDismissed,
    canvasClosing,
    openCanvas,
    closeCanvas,
    fileView,
    openFile,
  };
};

export type ChatCanvasApi = ReturnType<typeof useChatCanvas>;
