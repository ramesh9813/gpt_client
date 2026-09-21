import { useState } from "react";
import type { DeviceImage, DeviceStatus } from "./useDeviceImages";

type RecentTrayProps = {
  open: boolean;
  recentPhotos: string[];
  recentScreenshots: string[];
  devicePhotos: DeviceImage[];
  deviceScreenshots: DeviceImage[];
  deviceStatus: DeviceStatus;
  onAllowDevice: () => void;
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
}: {
  images: string[];
  attached: string[];
  onPick: (src: string) => void;
  emptyLabel: string;
  rowLabel: string;
}) => (
  <div className="composer-recents-section">
    <div className="composer-recents-label">{rowLabel}</div>
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
 * recent photos, second row device recent screenshots (both newest-first);
 * session photos fill any gap. Attached images are never duplicated here —
 * they already sit in the input card. Device rows need a one-time folder
 * permission via the Allow button.
 */
export const RecentTray = ({
  open,
  recentPhotos,
  recentScreenshots,
  devicePhotos,
  deviceScreenshots,
  deviceStatus,
  onAllowDevice,
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
      {(deviceStatus === "idle" ||
        deviceStatus === "loading" ||
        deviceStatus === "denied") && (
        <div className="composer-recents-permit">
          {deviceStatus === "loading" ? (
            <span className="composer-recents-permit-text">
              Loading device photos…
            </span>
          ) : deviceStatus === "denied" ? (
            <span className="composer-recents-permit-text">
              Device photo access denied — enable it in the browser site
              settings, or try again.
            </span>
          ) : (
            <>
              <span className="composer-recents-permit-text">
                Show recent photos from this device?
              </span>
              <button
                type="button"
                className="composer-recents-permit-btn"
                onClick={onAllowDevice}
              >
                Allow access
              </button>
            </>
          )}
        </div>
      )}
      <PhotoRow
        images={photos}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent photos yet"
        rowLabel="Recent photos"
      />
      <PhotoRow
        images={screenshots}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent screenshots yet"
        rowLabel="Recent screenshots"
      />
    </div>
  );
};

export default RecentTray;
