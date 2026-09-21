import { useState } from "react";

type RecentTrayProps = {
  open: boolean;
  recents: string[];
  attached: string[];
  onPick: (src: string) => void;
  onBrowse: () => void;
  onClose: () => void;
};

/**
 * Recent-images card: same footprint as the camera view. Shows recent
 * clicked / screenshot photos newest-first (up to ~5 visible, scroll for
 * more). Browse sits beside Expand in the header; Expand enlarges the card.
 */
export const RecentTray = ({
  open,
  recents,
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
      {recents.length > 0 ? (
        <div className="composer-recents-row">
          {recents.map((src, idx) => {
            const isAttached = attached.includes(src);
            return (
              <button
                key={idx}
                type="button"
                className={`composer-recents-thumb${isAttached ? " composer-recents-thumb--attached" : ""}`}
                onClick={() => onPick(src)}
                aria-label={`Attach recent image ${idx + 1}${isAttached ? " (attached)" : ""}`}
                title={isAttached ? "Attached" : "Attach"}
              >
                <img
                  src={src}
                  alt={`Recent ${idx + 1}`}
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
        <div className="composer-recents-empty">
          <i
            className="bi bi-images composer-recents-empty-icon"
            aria-hidden="true"
          />
          <p className="composer-recents-empty-text">No recent images yet</p>
          <button
            type="button"
            className="composer-recents-empty-btn"
            onClick={onBrowse}
          >
            <i className="bi bi-folder2-open" aria-hidden="true" />
            <span>Browse photos</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentTray;
