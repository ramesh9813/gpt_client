import { useEffect, useState } from "react";
import { fileIcon, formatFileSize, isAudioFile, isVideoFile } from "../../../lib/fileChat";
import { getAttachmentUrl } from "../../../lib/fileStorage";
import { getMediaUrl } from "../../../lib/mediaStore";

type FileMeta = { name: string; mime?: string; size?: number; attachmentId?: string };
type Props = { files?: FileMeta[] | null; conversationId?: string };

const useRemoteUrl = (attachmentId?: string, download = false) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!attachmentId) {
      setUrl(null);
      return () => {
        live = false;
      };
    }
    void getAttachmentUrl(attachmentId, download).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [attachmentId, download]);
  return url;
};

const ChipBody = ({ file }: { file: FileMeta }) => (
  <>
    <i className={`bi ${fileIcon(file.name, file.mime || "")} msg-file-chip-icon`} aria-hidden="true" />
    <span className="msg-file-chip-name">{file.name}</span>
    {typeof file.size === "number" ? <span className="msg-file-chip-size">{formatFileSize(file.size)}</span> : null}
  </>
);

const Chip = ({ file, index }: { file: FileMeta; index: number }) => {
  const url = useRemoteUrl(file.attachmentId, true);
  if (url) {
    return (
      <a
        key={`${file.name}-${index}`}
        className="msg-file-chip"
        href={url}
        target="_blank"
        rel="noreferrer"
        download={file.name}
        title={`Download ${file.name}`}
      >
        <ChipBody file={file} />
      </a>
    );
  }
  return (
    <span key={`${file.name}-${index}`} className="msg-file-chip" title={file.name}>
      <ChipBody file={file} />
    </span>
  );
};

// Sent audio/video with remote bytes: inline player from object storage.
// Falls back to local IndexedDB bytes for same-device offline/replay use.
const MediaFile = ({ conversationId, file, index }: { conversationId: string; file: FileMeta; index: number }) => {
  const remoteUrl = useRemoteUrl(file.attachmentId);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getMediaUrl(conversationId, file.name, file.size ?? 0).then((u) => {
      if (live) setLocalUrl(u);
    });
    return () => {
      live = false;
    };
  }, [conversationId, file.name, file.size]);
  const url = (!remoteFailed && remoteUrl) || localUrl;
  if (!url) return <Chip file={file} index={index} />;
  const audio = isAudioFile(file.name, file.mime || "");
  return (
    <div className="msg-media" role="group" aria-label={`${audio ? "Audio" : "Video"}: ${file.name}`}>
      <div className="msg-media-head" title={file.name}>
        <i className={`bi ${audio ? "bi-file-music" : "bi-file-play"} msg-file-chip-icon`} aria-hidden="true" />
        <span className="msg-file-chip-name">{file.name}</span>
      </div>
      {audio ? (
        <audio controls preload="metadata" src={url} className="msg-media-audio" onError={() => setRemoteFailed(true)} />
      ) : (
        <video controls playsInline preload="metadata" src={url} className="msg-media-video" onError={() => setRemoteFailed(true)} />
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
