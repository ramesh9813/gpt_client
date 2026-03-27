import { useEffect, useMemo, useState } from "react";
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
      className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
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
    <aside className="hidden lg:flex h-full w-[380px] flex-col border-l border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Canvas</div>
          <div className="text-xs text-[var(--muted)]">{blocks.length} blocks</div>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)]"
            title="Close canvas"
            type="button"
          >
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)] disabled:opacity-40"
          onClick={() => setActiveId(blocks[Math.max(0, activeIndex - 1)].id)}
          disabled={activeIndex <= 0}
          title="Previous block"
          type="button"
        >
          <i className="bi bi-chevron-left text-sm"></i>
        </button>
        <select
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)] disabled:opacity-40"
          onClick={() => setActiveId(blocks[Math.min(blocks.length - 1, activeIndex + 1)].id)}
          disabled={activeIndex >= blocks.length - 1}
          title="Next block"
          type="button"
        >
          <i className="bi bi-chevron-right text-sm"></i>
        </button>
        {previewable ? (
          <button
            onClick={() => setMode(mode === "preview" ? "code" : "preview")}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)]"
            title="Toggle preview"
            type="button"
          >
            <i className={`bi ${mode === "preview" ? "bi-code-slash" : "bi-eye"}`}></i>
            {mode === "preview" ? "Code" : "Preview"}
          </button>
        ) : null}
        {activeBlock ? <CopyButton text={activeBlock.code} /> : null}
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {activeBlock && mode === "preview" && previewable ? (
          <iframe
            title="Canvas preview"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-md border border-[var(--border)] bg-white"
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
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleRun}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] disabled:opacity-60"
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
          <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--sidebar)] p-3 text-xs text-[var(--text)]">
            <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Run output</span>
              {typeof currentRun.code === "number" ? (
                <span>Exit {currentRun.code}</span>
              ) : null}
            </div>
            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed">
              {currentRun.stdout || currentRun.stderr || "No output."}
            </pre>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default CanvasPanel;
