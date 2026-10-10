import { useEffect, useRef, useState, useCallback } from "react";
import { downloadImageAs } from "../../../lib/image";

export const MessageImages = ({ images }: { images?: string[] }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const count = images?.length ?? 0;

  const close = useCallback(() => setExpandedIdx(null), []);
  const hasMultiple = count > 1;
  // Finger swipe: remember where the touch started; a horizontal swipe moves
  // to the next/previous image and must not trigger tap-to-close.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

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

      {expandedSrc && (
        <div
          className="msg-image-lightbox msg-gallery-full"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image"
          onClick={() => {
            // A swipe ends with a click — don't treat it as tap-to-close.
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            close();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) touchStart.current = { x: t.clientX, y: t.clientY };
            swiped.current = false;
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start || !hasMultiple) return;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            // Horizontal swipe wins over vertical drift: finger left → next,
            // finger right → previous.
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              swiped.current = true;
              setExpandedIdx((prev) =>
                prev === null ? null : (prev + (dx < 0 ? 1 : -1) + count) % count
              );
            }
          }}
        >
          {/* Gallery fullscreen: only the image, plus overlay minimize and
              a single download icon. Tap anywhere (image included) to minimize. */}
          <img
            src={expandedSrc}
            alt="Expanded attachment"
            className="msg-gallery-full-img"
          />
          <button
            type="button"
            className="msg-gallery-minimize"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Minimize image"
            title="Minimize"
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            className="msg-gallery-download"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload("jpg", expandedIdx ?? 0);
            }}
            aria-label="Download image"
            title="Download"
          >
            <i className="bi bi-download" aria-hidden="true"></i>
          </button>
        </div>
      )}
    </>
  );
};
