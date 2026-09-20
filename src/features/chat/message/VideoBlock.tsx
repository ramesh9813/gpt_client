import { useState } from "react";
import { saveAs } from "file-saver";
import "./VideoBlock.css";

type VideoBlockProps = {
  videos?: string[];
};

type VideoItemProps = {
  src: string;
  index: number;
  total: number;
};

const VideoItem = ({ src, index, total }: VideoItemProps) => {
  const [failed, setFailed] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const filename: string = total === 1 ? "video.mp4" : `video-${index + 1}.mp4`;

  const handleDownload = async (): Promise<void> => {
    setDownloading(true);
    setDownloadError(null);
    try {
      // data:video/* URLs are fetchable directly, same as https: URLs.
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob: Blob = await res.blob();
      saveAs(blob, filename);
    } catch (err: unknown) {
      // Hosted CDNs often block cross-origin fetch: fall back to opening
      // the video in a new tab where the user can save it natively.
      if (src.startsWith("https:")) {
        window.open(src, "_blank", "noopener");
        setDownloadError(null);
      } else {
        setDownloadError(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      setDownloading(false);
    }
  };

  if (failed) {
    return (
      <div className="video-block-error" role="alert">
        Video failed to load.
      </div>
    );
  }

  return (
    <div className="video-block-item">
      <video
        controls
        preload="metadata"
        src={src}
        className="video-block-player"
        aria-label={`Generated video ${index + 1}`}
        onError={() => setFailed(true)}
      >
        Sorry, your browser does not support embedded videos.
      </video>
      <div className="video-block-row">
        <button
          type="button"
          className="video-block-download"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Download video ${index + 1}`}
          title={downloading ? "Downloading…" : "Download video"}
        >
          <i className="bi bi-download" aria-hidden="true"></i>
          <span>{downloading ? "Downloading…" : "Download"}</span>
        </button>
        {downloadError ? (
          <span className="video-block-download-error" role="alert">
            {downloadError}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const VideoBlock = ({ videos }: VideoBlockProps) => {
  if (!videos || videos.length === 0) return null;
  const clipped: string[] = videos.slice(0, 3);
  return (
    <div className="video-block" role="group" aria-label="Generated videos">
      {clipped.map((src: string, i: number) => (
        <VideoItem key={i} src={src} index={i} total={clipped.length} />
      ))}
    </div>
  );
};

export default VideoBlock;
