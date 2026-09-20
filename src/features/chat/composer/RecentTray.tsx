type RecentTrayProps = {
  open: boolean;
  recents: string[];
  attached: string[];
  onPick: (src: string) => void;
  onBrowse: () => void;
  onClose: () => void;
};

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
      <div className="composer-recents-row">
        <button
          type="button"
          className="composer-recents-browse"
          onClick={onBrowse}
          aria-label="Browse for images"
          title="Browse for images"
        >
          <i className="bi bi-folder2-open composer-recents-browse-icon" aria-hidden="true" />
          <span className="composer-recents-browse-label">Browse</span>
        </button>
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
    </div>
  );
};

export default RecentTray;
