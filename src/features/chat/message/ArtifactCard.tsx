import "./ArtifactCard.css";
import { useEffect, useState } from "react";
import type { ArtifactBlock } from "../artifact";

type ArtifactCardProps = {
  artifact: ArtifactBlock;
};

/**
 * Inline expanding artifact card: collapsed compact row in the thread;
 * Open expands the SAME card in place to a 75vh simulation, Expand takes
 * it to 90vh. Input area is never hidden.
 */
export const ArtifactCard = ({ artifact }: ArtifactCardProps) => {
  const title = artifact.title?.trim() || "Interactive Simulation";
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOpen(false);
    setExpanded(false);
    setMode("preview");
    setCopied(false);
  }, [artifact.id, artifact.code]);

  const copyCode = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(artifact.code).then(done).catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = artifact.code;
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
  };

  const downloadCode = () => {
    const blob = new Blob([artifact.code], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = title
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
  };

  if (!open) {
    return (
      <div
        className="artifact-card"
        role="group"
        aria-label={`Interactive simulation: ${title}`}
      >
        <div className="artifact-card-icon" aria-hidden="true">
          <i className="bi bi-play-circle artifact-card-icon-glyph"></i>
        </div>
        <div className="artifact-card-text">
          <div className="artifact-card-label">Interactive Simulation Created</div>
          <div className="artifact-card-title" title={title}>
            {title}
          </div>
        </div>
        <button
          type="button"
          className="artifact-card-open"
          onClick={() => setOpen(true)}
          title="Open interactive preview"
          aria-label={`Open interactive simulation: ${title}`}
          aria-expanded={false}
        >
          <i className="bi bi-arrows-angle-expand" aria-hidden="true"></i>
          <span className="artifact-card-open-text" aria-hidden="true">
            Open
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`artifact-card artifact-card--open${expanded ? " artifact-card--expanded" : ""}`}
      role="group"
      aria-label={`Interactive simulation: ${title}`}
    >
      <div className="artifact-card-bar">
        <div className="artifact-card-bar-title" title={title}>
          {title}
        </div>
        <div className="artifact-card-bar-actions">
          <button
            type="button"
            className="artifact-card-tool"
            onClick={() => setMode(mode === "preview" ? "code" : "preview")}
            title={mode === "preview" ? "Show code" : "Show preview"}
            aria-label={mode === "preview" ? "Show code" : "Show preview"}
            aria-pressed={mode === "code"}
          >
            <i
              className={`bi ${mode === "preview" ? "bi-code-slash" : "bi-eye"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="artifact-card-tool"
            onClick={copyCode}
            title={copied ? "Copied" : "Copy code"}
            aria-label={copied ? "Copied" : "Copy code"}
          >
            <i
              className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="artifact-card-tool"
            onClick={downloadCode}
            title="Download code (.html)"
            aria-label="Download code (.html)"
          >
            <i className="bi bi-download" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="artifact-card-tool"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Shrink to 75% height" : "Expand to 90% height"}
            aria-label={expanded ? "Shrink to 75% height" : "Expand to 90% height"}
            aria-pressed={expanded}
          >
            <i
              className={`bi ${expanded ? "bi-arrows-collapse" : "bi-arrows-expand"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="artifact-card-tool"
            onClick={() => {
              setOpen(false);
              setExpanded(false);
            }}
            title="Collapse simulation"
            aria-label="Collapse simulation"
            aria-expanded={true}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div className="artifact-card-stage">
        {mode === "preview" ? (
          <iframe
            title={title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="artifact-card-frame"
            srcDoc={artifact.code}
          />
        ) : (
          <pre className="artifact-card-code" tabIndex={0}>
            {artifact.code}
          </pre>
        )}
      </div>
    </div>
  );
};

export default ArtifactCard;
