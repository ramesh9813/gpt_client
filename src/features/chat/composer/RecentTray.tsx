import { useState } from "react";
import type { DeviceImage, DeviceStatus } from "./useDeviceImages";

type RecentTrayProps = {
  open: boolean;
  recentPhotos: string[];
  recentScreenshots: string[];
  devicePhotos: DeviceImage[];
  deviceScreenshots: DeviceImage[];
  deviceStatus: DeviceStatus;
  photoFolderName: string | null;
  shotsFolderName: string | null;
  onPickPhotosFolder: () => void;
  onPickScreenshotsFolder: () => void;
  attached: string[];
  onPick: (src: string) => void;
  onBrowse: () => void;
  onClose: () => void;
};

const PhotoRow = ({
  images,
  attached,
  onPick,
  emptyLabel,
  rowLabel,
  folderName,
  chooseTitle,
  onChooseFolder,
}: {
  images: string[];
  attached: string[];
  onPick: (src: string) => void;
  emptyLabel: string;
  rowLabel: string;
  folderName: string | null;
  chooseTitle: string;
  onChooseFolder: () => void;
}) => (
  <div className="composer-recents-section">
    <div className="composer-recents-label-row">
      <div className="composer-recents-label">{rowLabel}</div>
      <button
        type="button"
        className="composer-recents-folder-btn"
        onClick={onChooseFolder}
        aria-label={chooseTitle}
        title={folderName ? `${chooseTitle} (now: ${folderName})` : chooseTitle}
      >
        <i className="bi bi-folder2-open" aria-hidden="true" />
        {folderName ? (
          <span className="composer-recents-folder-name">{folderName}</span>
        ) : null}
      </button>
    </div>
    {images.length > 0 ? (
      <div className="composer-recents-row">
        {images.map((src, idx) => {
          const isAttached = attached.includes(src);
          return (
            <button
              key={idx}
              type="button"
              className={`composer-recents-thumb${isAttached ? " composer-recents-thumb--attached" : ""}`}
              onClick={() => onPick(src)}
              aria-label={`Attach ${rowLabel.toLowerCase()} image ${idx + 1}${isAttached ? " (attached)" : ""}`}
              title={isAttached ? "Attached" : "Attach"}
            >
              <img
                src={src}
                alt={`${rowLabel} ${idx + 1}`}
                loading="lazy"
                className="composer-recents-img"
              />
              {isAttached && (
                <span className="composer-recents-check" aria-hidden="true">
                  <i className="bi bi-check" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    ) : (
      <div className="composer-recents-row-empty">{emptyLabel}</div>
    )}
  </div>
);

/**
 * Recents card: same footprint as the camera view. First row shows device
 * camera photos, second row device screenshots (both newest-first); session
 * photos fill any gap. Attached images are never duplicated here — they
 * already sit in the input card. Each row has its own folder button so the
 * user can grant the camera folder and the screenshots folder separately.
 */
export const RecentTray = ({
  open,
  recentPhotos,
  recentScreenshots,
  devicePhotos,
  deviceScreenshots,
  deviceStatus,
  photoFolderName,
  shotsFolderName,
  onPickPhotosFolder,
  onPickScreenshotsFolder,
  attached,
  onPick,
  onBrowse,
  onClose,
}: RecentTrayProps) => {
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;

  const isAttached = (src: string) => attached.includes(src);
  const photos = [
    ...devicePhotos.map((d) => d.url),
    ...recentPhotos.filter((s) => !isAttached(s)),
  ];
  const screenshots = [
    ...deviceScreenshots.map((d) => d.url),
    ...recentScreenshots.filter((s) => !isAttached(s)),
  ];

  return (
    <div
      className={`composer-recents${expanded ? " composer-recents--large" : ""}`}
      role="dialog"
      aria-label="Recent images"
    >
      <div className="composer-recents-head">
        <span className="composer-recents-title">Recent</span>
        <div className="composer-recents-head-actions">
          <button
            type="button"
            className="composer-recents-browse-btn"
            onClick={onBrowse}
            aria-label="Browse photos"
            title="Browse photos"
          >
            <i className="bi bi-folder2-open" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="composer-recents-expand"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Shrink recent images" : "Expand recent images"}
            aria-pressed={expanded}
            title={expanded ? "Shrink" : "Expand"}
          >
            <i
              className={`bi ${expanded ? "bi-arrows-collapse" : "bi-arrows-expand"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="composer-recents-close"
            onClick={onClose}
            aria-label="Close recent images"
            title="Close"
          >
            <i className="bi bi-x" aria-hidden="true" />
          </button>
        </div>
      </div>
      {deviceStatus === "denied" && (
        <div className="composer-recents-permit">
          <span className="composer-recents-permit-text">
            Device photo access denied — enable it in the browser site
            settings, then pick the folders again.
          </span>
        </div>
      )}
      <PhotoRow
        images={photos}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent photos yet"
        rowLabel="Recent photos"
        folderName={photoFolderName}
        chooseTitle="Choose camera folder"
        onChooseFolder={onPickPhotosFolder}
      />
      <PhotoRow
        images={screenshots}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent screenshots yet"
        rowLabel="Recent screenshots"
        folderName={shotsFolderName}
        chooseTitle="Choose screenshots folder"
        onChooseFolder={onPickScreenshotsFolder}
      />
    </div>
  );
};

export default RecentTray;
