import "./ArtifactViewer.css";
import { useEffect, useState } from "react";

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
  const [copied, setCopied] = useState(false);
  // Panel opens at 75% viewport height; expand takes it to 100%.
  const [expanded, setExpanded] = useState(false);

  // Reset to rendered preview at 75% height whenever a different artifact opens.
  useEffect(() => {
    setMode("preview");
    setExpanded(false);
    setCopied(false);
  }, [artifact?.id]);

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

  if (!artifact) {
    return null;
  }

  const title = artifact.title?.trim() || "Artifact";

  return (
    <aside
      className={`artifact-root${expanded ? " artifact-root--expanded" : ""}`}
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
            onClick={() => {
              const text = artifact.code;
              const done = () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              };
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(() => {});
              } else {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                try {
                  document.execCommand("copy");
                  done();
                } catch {
                  // clipboard unavailable
                }
                document.body.removeChild(ta);
              }
            }}
            title={copied ? "Copied" : "Copy code"}
            aria-label={copied ? "Copied" : "Copy code"}
          >
            <i
              className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"} artifact-btn-icon`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="artifact-btn"
            onClick={() => {
              const blob = new Blob([artifact.code], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const safe = (artifact.title || "artifact")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 48);
              a.href = url;
              a.download = `${safe || "artifact"}.html`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 4000);
            }}
            title="Download code (.html)"
            aria-label="Download code (.html)"
          >
            <i className="bi bi-download artifact-btn-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="artifact-btn"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Shrink to 75% height" : "Expand to full height"}
            aria-label={expanded ? "Shrink to 75% height" : "Expand to full height"}
            aria-pressed={expanded}
          >
            <i
              className={`bi ${expanded ? "bi-arrows-collapse" : "bi-arrows-expand"} artifact-btn-icon`}
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
