import { useEffect, useMemo, useState } from "react";
import { buildCanvasData } from "../canvas";
import type { ChatMessage } from "../MessageList";

export const useChatCanvas = (messages: ChatMessage[]) => {
  const canvasData = useMemo(() => buildCanvasData(messages), [messages]);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasDismissed, setCanvasDismissed] = useState(false);

  useEffect(() => {
    if (canvasData.blocks.length === 0) {
      setShowCanvas(false);
      setCanvasDismissed(false);
      return;
    }
    if (!canvasDismissed) {
      setShowCanvas(true);
    }
  }, [canvasData.blocks.length, canvasDismissed]);

  return {
    canvasData,
    showCanvas,
    setShowCanvas,
    canvasDismissed,
    setCanvasDismissed,
  };
};

export type ChatCanvasApi = ReturnType<typeof useChatCanvas>;
