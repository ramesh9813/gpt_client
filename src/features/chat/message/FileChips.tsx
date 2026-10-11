import { useEffect, useState } from "react";
import { fileIcon, formatFileSize, isAudioFile, isVideoFile } from "../../../lib/fileChat";
import { getMediaUrl } from "../../../lib/mediaStore";

type FileMeta = { name: string; mime?: string; size?: number };
type Props = { files?: FileMeta[] | null; conversationId?: string };

const Chip = ({ file, index }: { file: FileMeta; index: number }) => (
  <span key={`${file.name}-${index}`} className="msg-file-chip" title={file.name}>
    <i className={`bi ${fileIcon(file.name, file.mime || "")} msg-file-chip-icon`} aria-hidden="true" />
    <span className="msg-file-chip-name">{file.name}</span>
    {typeof file.size === "number" ? <span className="msg-file-chip-size">{formatFileSize(file.size)}</span> : null}
  </span>
);

// Sent audio/video with local bytes: inline player (tap play to listen/watch).
// Without local bytes (other device, store cleared) it degrades to a chip.
const MediaFile = ({ conversationId, file, index }: { conversationId: string; file: FileMeta; index: number }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getMediaUrl(conversationId, file.name, file.size ?? 0).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [conversationId, file.name, file.size]);
  if (!url) return <Chip file={file} index={index} />;
  const audio = isAudioFile(file.name, file.mime || "");
  return (
    <div className="msg-media" role="group" aria-label={`${audio ? "Audio" : "Video"}: ${file.name}`}>
      <div className="msg-media-head" title={file.name}>
        <i className={`bi ${audio ? "bi-file-music" : "bi-file-play"} msg-file-chip-icon`} aria-hidden="true" />
        <span className="msg-file-chip-name">{file.name}</span>
      </div>
      {audio ? (
        <audio controls preload="metadata" src={url} className="msg-media-audio" />
      ) : (
        <video controls playsInline preload="metadata" src={url} className="msg-media-video" />
      )}
    </div>
  );
};

export const FileChips = ({ files, conversationId }: Props) => {
  if (!files || files.length === 0) return null;
  return (
    <div className="msg-file-chips" role="group" aria-label={`Attached files: ${files.length}`}>
      {files.map((f, i) =>
        conversationId && (isAudioFile(f.name, f.mime || "") || isVideoFile(f.name, f.mime || "")) ? (
          <MediaFile key={`${f.name}-${i}`} conversationId={conversationId} file={f} index={i} />
        ) : (
          <Chip key={`${f.name}-${i}`} file={f} index={i} />
        )
      )}
    </div>
  );
};

export default FileChips;
