import "./CanvasPanel.css";
import { useEffect, useMemo, useState, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsDark } from "../../lib/useIsDark";
import { CanvasBlock } from "./canvas";
import { buildPreviewDoc, isPreviewableBlock, isRunnableBlock } from "./canvas/canvasUtils";
import { CanvasHeader } from "./canvas/CanvasHeader";
import { BlockNavigator } from "./canvas/BlockNavigator";
import { RunnerPanel, useCodeRunner } from "./canvas/RunnerPanel";

export type { CanvasBlock };

const CanvasPanel = ({
  blocks,
  closing,
  onClose
}: {
  blocks: CanvasBlock[];
  closing?: boolean;
  onClose?: () => void;
}) => {
  const [activeId, setActiveId] = useState<string | null>(
    blocks.length ? blocks[blocks.length - 1].id : null
  );
  const [mode, setMode] = useState<"code" | "preview">("code");
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { runState, runBlock } = useCodeRunner();
  const isDark = useIsDark();
  // Tracks the latest block signature so newly arrived code takes over the
  // view, while manual browsing + in-place streaming growth stay put.
  const lastSeenId = useRef<string | null>(
    blocks.length ? blocks[blocks.length - 1].id : null
  );

  useEffect(() => {
    if (!blocks.length) {
      setActiveId(null);
      lastSeenId.current = null;
      return;
    }
    const latestId = blocks[blocks.length - 1].id;
    // New latest code arrived (new message / new fence) -> always show it.
    if (lastSeenId.current !== latestId) {
      lastSeenId.current = latestId;
      setActiveId(latestId);
      return;
    }
    // Selection vanished (e.g. conversation switch) -> fall back to latest.
    if (!activeId || !blocks.some((block) => block.id === activeId)) {
      setActiveId(latestId);
    }
  }, [blocks, activeId]);

  const activeIndex = useMemo(
    () => Math.max(0, blocks.findIndex((block) => block.id === activeId)),
    [blocks, activeId]
  );
  const activeBlock = useMemo(
    () => blocks[activeIndex],
    [blocks, activeIndex]
  );
  const previewable = useMemo(
    () => isPreviewableBlock(activeBlock),
    [activeBlock]
  );
  const runnable = useMemo(
    () => isRunnableBlock(activeBlock),
    [activeBlock]
  );

  const currentRun = activeBlock ? runState[activeBlock.id] : undefined;
  const isRunning = currentRun?.status === "running";

  useEffect(() => {
    if (!previewable && mode === "preview") {
      setMode("code");
    }
  }, [previewable, mode]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;

      // Constrain width between 300px and 800px
      if (newWidth >= 300 && newWidth <= 800) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleRun = () => {
    if (!activeBlock) return;
    void runBlock(activeBlock);
  };

  if (!blocks.length) {
    return null;
  }

  return (
    <aside
      ref={containerRef}
      className={`canvas-root${closing ? " canvas-root--closing" : ""}`}
      style={typeof window !== "undefined" && window.innerWidth >= 1024 ? { width: `${width}px` } : undefined}
    >
      <div
        className="canvas-resize"
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize canvas"
      />
      <CanvasHeader blockCount={blocks.length} onClose={onClose} />
      <BlockNavigator
        blocks={blocks}
        activeId={activeBlock?.id ?? activeId}
        activeIndex={activeIndex}
        mode={mode}
        previewable={previewable}
        copyText={activeBlock?.code}
        onSelect={setActiveId}
        onPrev={() => setActiveId(blocks[Math.max(0, activeIndex - 1)].id)}
        onNext={() => setActiveId(blocks[Math.min(blocks.length - 1, activeIndex + 1)].id)}
        onToggleMode={() => setMode(mode === "preview" ? "code" : "preview")}
      />
      <div className="canvas-content">
        {activeBlock && mode === "preview" && previewable ? (
          <iframe
            title="Canvas preview"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="canvas-preview-frame"
            srcDoc={buildPreviewDoc(activeBlock)}
          />
        ) : activeBlock ? (
          <SyntaxHighlighter
            PreTag="div"
            language={activeBlock.language}
            style={isDark ? vscDarkPlus : oneLight}
            codeTagProps={{
              style: {
                backgroundColor: "transparent",
                padding: 0
              }
            }}
            customStyle={{
              margin: 0,
              background: isDark ? "transparent" : "#ffffff",
              padding: "0.875rem",
              fontSize: "13px",
              lineHeight: 1.6,
              borderRadius: "12px",
              border: isDark ? "none" : "1px solid var(--border)"
            }}
          >
            {activeBlock.code}
          </SyntaxHighlighter>
        ) : null}
        {activeBlock && runnable ? (
          <RunnerPanel
            activeBlock={activeBlock}
            currentRun={currentRun}
            isRunning={!!isRunning}
            showRunButton={mode === "code"}
            onRun={handleRun}
          />
        ) : null}
      </div>
    </aside>
  );
};

export default CanvasPanel;
