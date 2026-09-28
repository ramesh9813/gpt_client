import { useEffect, useState, useCallback } from "react";
import { downloadImageAs } from "../../../lib/image";

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
        setExpandedIdx((prev) => (prev === null ? null : (prev - 1 + count) % count));
      }
      if (e.key === "ArrowRight") {
        setExpandedIdx((prev) => (prev === null ? null : (prev + 1) % count));
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

  const capped = 4;
  const display = count > capped ? images.slice(0, capped) : images;
  const extra = count > capped ? count - capped : 0;

  const layoutCls =
    count === 1 ? "msg-gallery--1" : count === 2 ? "msg-gallery--2" : count === 3 ? "msg-gallery--3" : "msg-gallery--4";

  const expandedSrc =
    expandedIdx !== null && expandedIdx >= 0 && expandedIdx < count ? images[expandedIdx] : null;

  const handleDownload = (format: "jpg" | "png", idx: number) => {
    const src = images[idx];
    if (src) void downloadImageAs(src, format, idx);
  };

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
              <img src={src} alt={`Attachment ${i + 1}`} loading="lazy" decoding="async" className="msg-gallery-img" />
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

      {/* Download tab: shown whenever images exist. Theme-consistent pill bar. */}
      <div className="msg-gallery-actions" role="group" aria-label="Download image">
        <span className="msg-gallery-actions-label">Download:</span>
        <button
          type="button"
          className="msg-gallery-dl"
          onClick={() => handleDownload("jpg", expandedIdx ?? 0)}
          title={count === 1 ? "Download as JPG" : `Download image ${(expandedIdx ?? 0) + 1} as JPG`}
          aria-label="Download JPG"
        >
          <i className="bi bi-download" aria-hidden="true" /> JPG
        </button>
        <button
          type="button"
          className="msg-gallery-dl"
          onClick={() => handleDownload("png", expandedIdx ?? 0)}
          title={count === 1 ? "Download as PNG" : `Download image ${(expandedIdx ?? 0) + 1} as PNG`}
          aria-label="Download PNG"
        >
          <i className="bi bi-download" aria-hidden="true" /> PNG
        </button>
        {count > 1 && <span className="msg-gallery-actions-hint">{count} images — expand to pick</span>}
      </div>

      {expandedSrc && (
        <div className="msg-image-lightbox" role="dialog" aria-modal="true" aria-label="Expanded image" onClick={close}>
          {/* Popcard: centered card showing complete full image + download tabs. Click inside does not close. */}
          <div
            className="msg-lightbox-card"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-lightbox-card-head">
              <div className="msg-lightbox-card-title">
                <i className="bi bi-image" aria-hidden="true" />
                <span>
                  Image {expandedIdx! + 1} of {count}
                </span>
              </div>
              <button type="button" className="msg-lightbox-card-close" onClick={close} aria-label="Close" title="Close">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <div className="msg-lightbox-card-body">
              <img src={expandedSrc} alt="Expanded attachment" className="msg-lightbox-card-img" />
            </div>

            <div className="msg-lightbox-card-foot">
              <button
                type="button"
                className="msg-lightbox-dl"
                onClick={() => handleDownload("jpg", expandedIdx!)}
                aria-label="Download JPG"
              >
                <i className="bi bi-filetype-jpg" aria-hidden="true" /> Download JPG
              </button>
              <button
                type="button"
                className="msg-lightbox-dl msg-lightbox-dl--alt"
                onClick={() => handleDownload("png", expandedIdx!)}
                aria-label="Download PNG"
              >
                <i className="bi bi-filetype-png" aria-hidden="true" /> Download PNG
              </button>
            </div>

            {hasMultiple && (
              <div className="msg-lightbox-card-nav" aria-hidden="false">
                <button
                  type="button"
                  className="msg-lightbox-nav msg-lightbox-prev"
                  onClick={() => setExpandedIdx((prev) => (prev === null ? null : (prev - 1 + count) % count))}
                  aria-label="Previous image"
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>
                <span className="msg-lightbox-counter">
                  {expandedIdx! + 1} / {count}
                </span>
                <button
                  type="button"
                  className="msg-lightbox-nav msg-lightbox-next"
                  onClick={() => setExpandedIdx((prev) => (prev === null ? null : (prev + 1) % count))}
                  aria-label="Next image"
                >
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
