import { fileIcon, formatFileSize } from "../../../lib/fileChat";

type FileMeta = { name: string; mime?: string; size?: number };
type Props = { files?: FileMeta[] | null };

export const FileChips = ({ files }: Props) => {
  if (!files || files.length === 0) return null;
  return (
    <div className="msg-file-chips" role="group" aria-label={`Attached files: ${files.length}`}>
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="msg-file-chip" title={f.name}>
          <i className={`bi ${fileIcon(f.name, f.mime || "")} msg-file-chip-icon`} aria-hidden="true" />
          <span className="msg-file-chip-name">{f.name}</span>
          {typeof f.size === "number" ? <span className="msg-file-chip-size">{formatFileSize(f.size)}</span> : null}
        </span>
      ))}
    </div>
  );
};

export default FileChips;
