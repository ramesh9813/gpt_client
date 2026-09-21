import { useState } from "react";

type RecentTrayProps = {
  open: boolean;
  recentPhotos: string[];
  recentScreenshots: string[];
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
 * Recents card: same footprint as the camera view. Two time-ordered rows —
 * Recent photos (camera / picked) and Recent screenshots (pasted) — each
 * scrolling horizontally. Browse sits beside Expand in the header.
 */
export const RecentTray = ({
  open,
  recentPhotos,
  recentScreenshots,
  attached,
  onPick,
  onBrowse,
  onClose,
}: RecentTrayProps) => {
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;
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
      <PhotoRow
        images={recentPhotos}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent photos yet"
        rowLabel="Recent photos"
      />
      <PhotoRow
        images={recentScreenshots}
        attached={attached}
        onPick={onPick}
        emptyLabel="No recent screenshots yet"
        rowLabel="Recent screenshots"
      />
    </div>
  );
};

export default RecentTray;
