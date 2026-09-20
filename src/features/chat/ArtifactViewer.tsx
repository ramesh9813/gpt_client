import "./ArtifactViewer.css";
import { useCallback, useEffect, useRef, useState } from "react";

export type ArtifactPreview = {
  id: string;
  title: string;
  code: string;
};

type ArtifactViewerProps = {
  artifact: ArtifactPreview | null;
  onClose?: () => void;
};

const ArtifactViewer = ({ artifact, onClose }: ArtifactViewerProps) => {
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Reset to rendered preview whenever a different artifact opens.
  useEffect(() => {
    setMode("preview");
  }, [artifact?.id]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement != null);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  useEffect(() => {
    if (!artifact) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [artifact, onClose]);

  const handleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current as (HTMLElement & {
          requestFullscreen?: () => Promise<void>;
        }) | null;
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
          return;
        }
      } else {
        await document.exitFullscreen();
        return;
      }
    } catch {
      // Fullscreen unavailable (embedded iframe / denied) — stay in place.
    }
  }, []);

  if (!artifact) {
    return null;
  }

  const title = artifact.title?.trim() || "Artifact";

  return (
    <aside
      ref={containerRef}
      className={`artifact-root${isFullscreen ? " artifact-root--fullscreen" : ""}`}
      aria-label={`Artifact viewer: ${title}`}
    >
      <div className="artifact-header">
        <div className="artifact-title-wrap">
          <div className="artifact-title" title={title}>
            {title}
          </div>
          <div className="artifact-subtitle">Interactive preview</div>
        </div>
        <div className="artifact-header-actions">
          <button
            type="button"
            className="artifact-btn"
            onClick={() => setMode(mode === "preview" ? "code" : "preview")}
            title={mode === "preview" ? "Show code" : "Show preview"}
            aria-label={mode === "preview" ? "Show code" : "Show preview"}
            aria-pressed={mode === "code"}
          >
            <i
              className={`bi ${mode === "preview" ? "bi-code-slash" : "bi-eye"} artifact-btn-icon`}
              aria-hidden="true"
            />
            <span className="artifact-btn-text">{mode === "preview" ? "Code" : "Preview"}</span>
          </button>
          <button
            type="button"
            className="artifact-btn"
            onClick={() => void handleFullscreen()}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-pressed={isFullscreen}
          >
            <i
              className={`bi ${isFullscreen ? "bi-fullscreen-exit" : "bi-arrows-fullscreen"} artifact-btn-icon`}
              aria-hidden="true"
            />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="artifact-close-btn"
              title="Close artifact viewer"
              aria-label="Close artifact viewer"
            >
              <i className="bi bi-x-lg artifact-close-icon" aria-hidden="true"></i>
            </button>
          ) : null}
        </div>
      </div>
      <div className="artifact-content">
        {mode === "preview" ? (
          <iframe
            title={title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="artifact-preview-frame"
            srcDoc={artifact.code}
          />
        ) : (
          <pre className="artifact-code-pre" tabIndex={0}>
            {artifact.code}
          </pre>
        )}
      </div>
    </aside>
  );
};

export default ArtifactViewer;
