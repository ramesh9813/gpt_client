import "./CanvasPanel.css";
import { useEffect, useMemo, useState, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CanvasBlock } from "./canvas";
import { apiFetch, ApiResponse } from "../../lib/api";

const PREVIEW_LANGS = new Set([
  "html",
  "css",
  "js",
  "javascript",
  "jss",
  "web",
  "webdev"
]);

const RUN_LANGS = new Set([
  "python",
  "py",
  "c",
  "cpp",
  "c++",
  "rust",
  "rs",
  "java"
]);

const normalizeRunLanguage = (language: string) => {
  const lang = language.toLowerCase();
  if (lang === "py") return "python";
  if (lang === "c++") return "cpp";
  if (lang === "rs") return "rust";
  return lang;
};

const isPreviewableBlock = (block?: CanvasBlock) => {
  if (!block) return false;
  if (PREVIEW_LANGS.has(block.language)) return true;
  const code = block.code.toLowerCase();
  return code.includes("<html") || code.includes("<body") || code.includes("<div");
};

const isRunnableBlock = (block?: CanvasBlock) => {
  if (!block) return false;
  return RUN_LANGS.has(block.language);
};

const buildPreviewDoc = (block: CanvasBlock) => {
  const lang = block.language;
  const code = block.code;
  if (lang === "css") {
    return `<!doctype html>
<html>
  <head>
    <style>
      ${code}
    </style>
  </head>
  <body>
    <div class="preview-root">Preview area</div>
  </body>
</html>`;
  }
  if (lang === "js" || lang === "javascript" || lang === "jss") {
    return `<!doctype html>
<html>
  <head>
    <style>
      body { font-family: sans-serif; padding: 16px; }
    </style>
  </head>
  <body>
    <div id="app">Preview area</div>
    <script>
      ${code}
    </script>
  </body>
</html>`;
  }
  if (lang === "html" || lang === "web" || lang === "webdev") {
    if (code.toLowerCase().includes("<html")) {
      return code;
    }
    return `<!doctype html>
<html>
  <body>
    ${code}
  </body>
</html>`;
  }
  if (code.toLowerCase().includes("<html")) {
    return code;
  }
  return `<!doctype html>
<html>
  <body>
    ${code}
  </body>
</html>`;
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="canvas-copy-btn"
      title="Copy code"
      type="button"
    >
      <i className={`bi ${copied ? "bi-check" : "bi-clipboard"}`}></i>
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const CanvasPanel = ({
  blocks,
  onClose
}: {
  blocks: CanvasBlock[];
  onClose?: () => void;
}) => {
  const [activeId, setActiveId] = useState<string | null>(blocks[0]?.id ?? null);
  const [mode, setMode] = useState<"code" | "preview">("code");
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [runState, setRunState] = useState<
    Record<
      string,
      { status: "idle" | "running" | "done" | "error"; stdout?: string; stderr?: string; code?: number }
    >
  >({});

  useEffect(() => {
    if (!blocks.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !blocks.some((block) => block.id === activeId)) {
      setActiveId(blocks[0].id);
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

  const handleRun = async () => {
    if (!activeBlock) return;
    const language = normalizeRunLanguage(activeBlock.language);
    setRunState((prev) => ({
      ...prev,
      [activeBlock.id]: { status: "running" }
    }));
    try {
      const response = await apiFetch<
        ApiResponse<{ stdout?: string; stderr?: string; output?: string; code?: number }>
      >("/api/runner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: activeBlock.code
        })
      });
      const output = response.data.output || "";
      const stdout = response.data.stdout || "";
      const stderr = response.data.stderr || "";
      setRunState((prev) => ({
        ...prev,
        [activeBlock.id]: {
          status: "done",
          stdout: output || stdout,
          stderr,
          code: response.data.code
        }
      }));
    } catch (err: any) {
      const message =
        err?.error?.message || "Run failed. Please try again.";
      setRunState((prev) => ({
        ...prev,
        [activeBlock.id]: {
          status: "error",
          stderr: message
        }
      }));
    }
  };

  if (!blocks.length) {
    return null;
  }

  return (
    <aside
      ref={containerRef}
      className="canvas-root"
      style={typeof window !== "undefined" && window.innerWidth >= 1024 ? { width: `${width}px` } : undefined}
    >
      <div
        className="canvas-resize"
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize canvas"
      />
      <div className="canvas-header">
        <div className="canvas-title-wrap">
          <div className="canvas-title">Canvas</div>
          <div className="canvas-subtitle">{blocks.length} blocks</div>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="canvas-close-btn"
            title="Close canvas"
            type="button"
          >
            <i className="bi bi-x-lg canvas-close-icon"></i>
          </button>
        ) : null}
      </div>
      <div className="canvas-toolbar">
        <button
          className="canvas-nav-btn"
          onClick={() => setActiveId(blocks[Math.max(0, activeIndex - 1)].id)}
          disabled={activeIndex <= 0}
          title="Previous block"
          type="button"
        >
          <i className="bi bi-chevron-left canvas-nav-icon"></i>
        </button>
        <select
          className="canvas-select"
          value={activeBlock?.id}
          onChange={(event) => setActiveId(event.target.value)}
        >
          {blocks.map((block, index) => (
            <option key={block.id} value={block.id}>
              {index + 1}. {block.language || "text"} • Msg {block.sourceIndex}
            </option>
          ))}
        </select>
        <button
          className="canvas-nav-btn"
          onClick={() => setActiveId(blocks[Math.min(blocks.length - 1, activeIndex + 1)].id)}
          disabled={activeIndex >= blocks.length - 1}
          title="Next block"
          type="button"
        >
          <i className="bi bi-chevron-right canvas-nav-icon"></i>
        </button>
        {previewable ? (
          <button
            onClick={() => setMode(mode === "preview" ? "code" : "preview")}
            className="canvas-preview-toggle"
            title="Toggle preview"
            type="button"
          >
            <i className={`bi ${mode === "preview" ? "bi-code-slash" : "bi-eye"}`}></i>
            {mode === "preview" ? "Code" : "Preview"}
          </button>
        ) : null}
        {activeBlock ? <CopyButton text={activeBlock.code} /> : null}
      </div>
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
            style={vscDarkPlus}
            codeTagProps={{
              style: {
                backgroundColor: "transparent",
                padding: 0
              }
            }}
            customStyle={{
              margin: 0,
              background: "transparent",
              padding: "0.75rem",
              fontSize: "12px"
            }}
          >
            {activeBlock.code}
          </SyntaxHighlighter>
        ) : null}
        {activeBlock && runnable && mode === "code" ? (
          <div className="canvas-run-row">
            <button
              onClick={handleRun}
              className="canvas-run-btn"
              title="Run code"
              type="button"
              disabled={isRunning}
            >
              <i className={`bi ${isRunning ? "bi-hourglass-split" : "bi-play-fill"}`}></i>
              {isRunning ? "Running..." : "Run"}
            </button>
          </div>
        ) : null}
        {activeBlock && runnable && currentRun ? (
          <div className="canvas-output">
            <div className="canvas-output-head">
              <span>Run output</span>
              {typeof currentRun.code === "number" ? (
                <span>Exit {currentRun.code}</span>
              ) : null}
            </div>
            <pre className="canvas-output-pre">
              {currentRun.stdout || currentRun.stderr || "No output."}
            </pre>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default CanvasPanel;
