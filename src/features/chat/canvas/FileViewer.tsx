import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsDark } from "../../../lib/useIsDark";
import { apiFetch, type ApiResponse } from "../../../lib/api";
import { codeLanguageOf, fileIcon, formatFileSize, isPdfFile, isTextFile } from "../../../lib/fileChat";

// Side-panel file viewer. Chat file chips open this for everything except
// audio/video (those play inline in the chat): text/code renders
// highlighted, PDFs render in the frame, anything else shows a meta card
// with a download link. Bytes stream from object storage via the signed
// attachment URL, so any signed-in device can reopen a sent file.

export type FileViewData = {
  name: string;
  mime?: string;
  size?: number;
  attachmentId?: string;
};

const signedUrl = async (attachmentId: string, download: boolean): Promise<string | null> => {
  try {
    const res = await apiFetch<ApiResponse<{ url: string }>>(`/api/files/${attachmentId}/url${download ? "?download=1" : ""}`);
    return res?.data?.url ?? null;
  } catch {
    return null;
  }
};

const ViewerBody = ({ file }: { file: FileViewData }) => {
  const isDark = useIsDark();
  const [url, setUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mime = file.mime || "";
  const wantsText = isTextFile(file.name, mime);

  useEffect(() => {
    let live = true;
    setUrl(null);
    setDownloadUrl(null);
    setText(null);
    setError(null);
    if (!file.attachmentId) {
      setError("This file's bytes were not stored — nothing to open.");
      return () => {
        live = false;
      };
    }
    const attachmentId = file.attachmentId;
    void (async () => {
      const inline = await signedUrl(attachmentId, false);
      if (!live) return;
      if (!inline) {
        setError("Couldn't get a link to this file. Try again shortly.");
        return;
      }
      setUrl(inline);
      if (wantsText) {
        try {
          const res = await fetch(inline);
          if (!res.ok) throw new Error(String(res.status));
          const body = await res.text();
          if (live) setText(body.length > 400_000 ? `${body.slice(0, 400_000)}\n…[showing first 400k of ${body.length} chars]` : body);
        } catch {
          if (live) setError("Couldn't read this file's content.");
        }
      }
      if (live) void signedUrl(attachmentId, true).then((u) => {
        if (live && u) setDownloadUrl(u);
      });
    })();
    return () => {
      live = false;
    };
  }, [file.attachmentId, file.name, wantsText]);

  if (error) {
    return (
      <div className="file-viewer-msg" role="status">
        <i className="bi bi-exclamation-triangle" aria-hidden="true" /> {error}
      </div>
    );
  }

  if (isPdfFile(file.name, mime)) {
    return url ? (
      <iframe
        title={`PDF: ${file.name}`}
        className="file-viewer-pdf"
        src={url}
        referrerPolicy="no-referrer"
      />
    ) : (
      <div className="file-viewer-msg" role="status">Loading PDF…</div>
    );
  }

  if (wantsText) {
    if (text === null) {
      return <div className="file-viewer-msg" role="status">Opening {file.name}…</div>;
    }
    const language = codeLanguageOf(file.name);
    if (language) {
      return (
        <SyntaxHighlighter
          PreTag="div"
          language={language}
          style={isDark ? vscDarkPlus : oneLight}
          codeTagProps={{ style: { backgroundColor: "transparent", padding: 0 } }}
          customStyle={{
            margin: 0,
            background: isDark ? "transparent" : "#ffffff",
            padding: "0.875rem",
            fontSize: "13px",
            lineHeight: 1.6,
            borderRadius: "12px",
            border: isDark ? "none" : "1px solid var(--border)",
          }}
        >
          {text}
        </SyntaxHighlighter>
      );
    }
    return <pre className="file-viewer-plain">{text}</pre>;
  }

  // Any other type: no inline renderer — meta card + download.
  return (
    <div className="file-viewer-meta">
      <i className={`bi ${fileIcon(file.name, mime)} file-viewer-meta-icon`} aria-hidden="true" />
      <div className="file-viewer-meta-name">{file.name}</div>
      <div className="file-viewer-meta-sub">
        {[mime || "unknown type", typeof file.size === "number" ? formatFileSize(file.size) : null]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div className="file-viewer-meta-sub">This file type can't be previewed here.</div>
      {downloadUrl ? (
        <a className="file-viewer-download" href={downloadUrl} download={file.name} target="_blank" rel="noreferrer">
          <i className="bi bi-download" aria-hidden="true" /> Download
        </a>
      ) : (
        <div className="file-viewer-msg" role="status">Preparing download link…</div>
      )}
    </div>
  );
};

export const FileViewer = ({
  file,
  onClose,
}: {
  file: FileViewData;
  onClose?: () => void;
}) => (
  <div className="file-viewer">
    <div className="file-viewer-head">
      <i className={`bi ${fileIcon(file.name, file.mime || "")} file-viewer-head-icon`} aria-hidden="true" />
      <span className="file-viewer-head-name" title={file.name}>{file.name}</span>
      {typeof file.size === "number" ? (
        <span className="file-viewer-head-size">{formatFileSize(file.size)}</span>
      ) : null}
      {onClose ? (
        <button type="button" className="file-viewer-close" onClick={onClose} title="Close viewer" aria-label="Close viewer">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      ) : null}
    </div>
    <div className="file-viewer-body">
      <ViewerBody file={file} />
    </div>
  </div>
);

export default FileViewer;
