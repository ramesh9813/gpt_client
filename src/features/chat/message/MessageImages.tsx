import { useEffect, useState, useCallback } from "react";

export const MessageImages = ({ images }: { images?: string[] }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const count = images?.length ?? 0;

  const close = useCallback(() => setExpandedIdx(null), []);
  const hasMultiple = count > 1;

  useEffect(() => {
    if (expandedIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (!hasMultiple) return;
      if (e.key === "ArrowLeft") {
        setExpandedIdx((prev) =>
          prev === null ? null : (prev - 1 + count) % count
        );
      }
      if (e.key === "ArrowRight") {
        setExpandedIdx((prev) =>
          prev === null ? null : (prev + 1) % count
        );
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expandedIdx, close, hasMultiple, count]);

  if (!images || count === 0) return null;

  // Fixed-dimension gallery: uniform 280x220 card regardless of count.
  // 4+ uses 2x2 with +N badge on last tile when overflow.
  const capped = 4;
  const display = count > capped ? images.slice(0, capped) : images;
  const extra = count > capped ? count - capped : 0;

  const layoutCls =
    count === 1
      ? "msg-gallery--1"
      : count === 2
        ? "msg-gallery--2"
        : count === 3
          ? "msg-gallery--3"
          : "msg-gallery--4";

  const expandedSrc =
    expandedIdx !== null && expandedIdx >= 0 && expandedIdx < count
      ? images[expandedIdx]
      : null;

  return (
    <>
      <div className={`msg-gallery ${layoutCls}`} role="group" aria-label={`Attached images: ${count}`}>
        {display.map((src, i) => {
          const isLastWithOverflow = i === capped - 1 && extra > 0;
          const originalIndex = i;
          return (
            <div
              key={i}
              className="msg-gallery-tile"
              onClick={() => setExpandedIdx(originalIndex)}
              role="button"
              tabIndex={0}
              aria-label={`Expand image ${i + 1} of ${count}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedIdx(originalIndex);
                }
              }}
            >
              <img
                src={src}
                alt={`Attachment ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="msg-gallery-img"
              />
              <button
                type="button"
                className="msg-gallery-expand"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIdx(originalIndex);
                }}
                aria-label="Expand image"
                title="Expand"
              >
                <i className="bi bi-arrows-angle-expand" aria-hidden="true" />
              </button>
              {isLastWithOverflow && (
                <div
                  className="msg-gallery-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedIdx(originalIndex);
                  }}
                  aria-hidden="true"
                >
                  +{extra}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedSrc && (
        <div
          className="msg-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image"
          onClick={close}
        >
          <button
            type="button"
            className="msg-image-lightbox-close"
            onClick={close}
            aria-label="Close expanded image"
            title="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>

          {hasMultiple && (
            <>
              <button
                type="button"
                className="msg-lightbox-nav msg-lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIdx((prev) =>
                    prev === null ? null : (prev - 1 + count) % count
                  );
                }}
                aria-label="Previous image"
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="msg-lightbox-nav msg-lightbox-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIdx((prev) =>
                    prev === null ? null : (prev + 1) % count
                  );
                }}
                aria-label="Next image"
              >
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </>
          )}

          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
          <img
            src={expandedSrc}
            alt="Expanded attachment"
            className="msg-image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          {hasMultiple && (
            <div className="msg-lightbox-counter" aria-live="polite">
              {expandedIdx! + 1} / {count}
            </div>
          )}
        </div>
      )}
    </>
  );
};
