import { Fragment, useEffect, useState } from "react";
import { fileIcon, formatFileSize, isAudioFile, isVideoFile, type FileAttachment } from "../../../lib/fileChat";

type Props = {
  files: FileAttachment[];
  reading?: boolean;
  fileError?: string | null;
  onRemove: (idx: number) => void;
  onClearError?: () => void;
};

// Pre-send preview: playable audio/video straight from the picked bytes.
const SourcePreview = ({ file }: { file: FileAttachment }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.source) return;
    let u: string | null = null;
    try {
      u = URL.createObjectURL(file.source);
      setUrl(u);
    } catch {
      setUrl(null);
    }
    return () => {
      if (u) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
    };
  }, [file.source]);
  if (!url) return null;
  return isAudioFile(file.name, file.mime) ? (
    <audio controls preload="metadata" src={url} className="composer-file-media" />
  ) : (
    <video controls playsInline preload="metadata" src={url} className="composer-file-media composer-file-video" />
  );
};

export const FileAttachments = ({ files, reading, fileError, onRemove, onClearError }: Props) => {
  if (files.length === 0 && !reading && !fileError) return null;
  return (
    <div className="composer-file-strip" role="region" aria-label="Attached files">
      {files.map((f, i) => (
        <Fragment key={`${f.name}-${i}`}>
          <div className="composer-file-item">
            <i className={`bi ${fileIcon(f.name, f.mime)} composer-file-icon`} aria-hidden="true" />
            <div className="composer-file-meta">
              <span className="composer-file-name" title={f.name}>{f.name}</span>
              <span className="composer-file-size">{formatFileSize(f.size)}</span>
            </div>
            <button type="button" className="composer-file-remove" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} title="Remove">
              <i className="bi bi-x" aria-hidden="true" />
            </button>
          </div>
          {f.source && (isAudioFile(f.name, f.mime) || isVideoFile(f.name, f.mime)) ? (
            <div className="composer-file-preview">
              <SourcePreview file={f} />
            </div>
          ) : null}
        </Fragment>
      ))}
      {reading ? <span className="composer-file-hint"><i className="bi bi-hourglass-split" aria-hidden="true" /> Reading…</span> : null}
      {fileError ? (
        <span className="composer-file-error" role="alert">
          {fileError}
          {onClearError ? <button type="button" className="composer-file-error-dismiss" onClick={onClearError} aria-label="Dismiss">×</button> : null}
        </span>
      ) : null}
    </div>
  );
};

export default FileAttachments;
