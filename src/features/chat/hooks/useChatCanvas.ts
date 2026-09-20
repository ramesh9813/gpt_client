import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCanvasData } from "../canvas";
import type { ChatMessage } from "../MessageList";

// Canvas opens ONLY on explicit user action (header button or swipe).
// Close is animated: `closing` plays the slide/fade-out, then the panel unmounts.
const CLOSE_ANIMATION_MS = 250;

export const useChatCanvas = (messages: ChatMessage[]) => {
  const canvasData = useMemo(() => buildCanvasData(messages), [messages]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasDismissed, setCanvasDismissed] = useState(false);
  const [canvasClosing, setCanvasClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (canvasData.blocks.length === 0) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setShowCanvas(false);
      setCanvasClosing(false);
      setCanvasDismissed(false);
    }
  }, [canvasData.blocks.length]);

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

  const closeCanvas = useCallback(() => {
    setCanvasDismissed(true);
    setCanvasClosing(true);
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
  };
};

export type ChatCanvasApi = ReturnType<typeof useChatCanvas>;
