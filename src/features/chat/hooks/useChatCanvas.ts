import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCanvasData } from "../canvas";
import type { ChatMessage } from "../MessageList";

// Canvas always shows the chat's latest code: it auto-opens whenever code
// blocks exist and follows new arrivals. A manual close is respected until
// newer code lands (or the conversation changes).
// Close is animated: `closing` plays the slide/fade-out, then the panel unmounts.
const CLOSE_ANIMATION_MS = 250;

export const useChatCanvas = (messages: ChatMessage[]) => {
  const canvasData = useMemo(() => buildCanvasData(messages), [messages]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasDismissed, setCanvasDismissed] = useState(false);
  const [canvasClosing, setCanvasClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Signature of the latest block when the user last closed. A different
  // latest id means newer code arrived -> reopen.
  const dismissedLastId = useRef<string | null>(null);
  const lastBlockId = canvasData.blocks.length
    ? canvasData.blocks[canvasData.blocks.length - 1].id
    : null;
  // Mirror for the close handler so it never captures a stale block id.
  const lastBlockIdRef = useRef<string | null>(lastBlockId);
  lastBlockIdRef.current = lastBlockId;

  useEffect(() => {
    if (canvasData.blocks.length === 0) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setShowCanvas(false);
      setCanvasClosing(false);
      setCanvasDismissed(false);
      dismissedLastId.current = null;
      return;
    }
    // Always show the latest code: auto-open when hidden, and reopen after
    // a manual close once newer code arrives (different latest block id).
    if (dismissedLastId.current === null || dismissedLastId.current !== lastBlockId) {
      if (!showCanvas || canvasClosing) {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setCanvasClosing(false);
        setShowCanvas(true);
        setCanvasDismissed(false);
      }
    }
  }, [canvasData.blocks.length, lastBlockId, showCanvas, canvasClosing]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const openCanvas = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    dismissedLastId.current = null;
    setCanvasClosing(false);
    setShowCanvas(true);
    setCanvasDismissed(false);
  }, []);

  const closeCanvas = useCallback(() => {
    dismissedLastId.current = lastBlockIdRef.current;
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
