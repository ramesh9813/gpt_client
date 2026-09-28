import { fileIcon, formatFileSize, type FileAttachment } from "../../../lib/fileChat";

type Props = {
  files: FileAttachment[];
  reading?: boolean;
  fileError?: string | null;
  onRemove: (idx: number) => void;
  onClearError?: () => void;
};

export const FileAttachments = ({ files, reading, fileError, onRemove, onClearError }: Props) => {
  if (files.length === 0 && !reading && !fileError) return null;
  return (
    <div className="composer-file-strip" role="region" aria-label="Attached files">
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="composer-file-item">
          <i className={`bi ${fileIcon(f.name, f.mime)} composer-file-icon`} aria-hidden="true" />
          <div className="composer-file-meta">
            <span className="composer-file-name" title={f.name}>{f.name}</span>
            <span className="composer-file-size">{formatFileSize(f.size)}</span>
          </div>
          <button type="button" className="composer-file-remove" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} title="Remove">
            <i className="bi bi-x" aria-hidden="true" />
          </button>
        </div>
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
