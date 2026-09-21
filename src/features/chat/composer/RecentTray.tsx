type RecentTrayProps = {
  open: boolean;
  recents: string[];
  attached: string[];
  onPick: (src: string) => void;
  onBrowse: () => void;
  onClose: () => void;
};

/**
 * Recent-images card: same footprint as the camera view (50dvh). Shows
 * recent images by default in a horizontal snap-scroll row; the expand
 * button opens the system photo selector.
 */
export const RecentTray = ({
  open,
  recents,
  attached,
  onPick,
  onBrowse,
  onClose,
}: RecentTrayProps) => {
  if (!open) return null;
  return (
    <div className="composer-recents" role="dialog" aria-label="Recent images">
      <div className="composer-recents-head">
        <span className="composer-recents-title">Recent</span>
        <div className="composer-recents-head-actions">
          <button
            type="button"
            className="composer-recents-expand"
            onClick={onBrowse}
            aria-label="Open system photo selector"
            title="Open system photo selector"
          >
            <i className="bi bi-arrows-expand" aria-hidden="true" />
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
