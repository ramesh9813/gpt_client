import { useEffect, useRef, useState, useCallback } from "react";
import { downloadImageAs } from "../../../lib/image";

export const MessageImages = ({ images }: { images?: string[] }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const count = images?.length ?? 0;

  // Slide animation direction for photo changes (0 = none, e.g. on open).
  const [slideDir, setSlideDir] = useState<0 | 1 | -1>(0);
  const close = useCallback(() => {
    setExpandedIdx(null);
    setSlideDir(0);
  }, []);
  const hasMultiple = count > 1;
  const go = useCallback((dir: 1 | -1) => {
    setSlideDir(dir);
    setExpandedIdx((prev) => (prev === null ? null : (prev + dir + count) % count));
  }, [count]);
  // Finger swipe: remember where the touch started; a horizontal swipe moves
  // to the next/previous image and must not trigger tap-to-close.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  // Inspect zoom: pinch (mobile) / wheel (desktop) magnifies up to 4x, drag
  // pans while zoomed. Reset on every photo change so each opens full-frame.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pinchStart.current = null;
    panStart.current = null;
  }, [expandedIdx]);
  const clampZoom = (v: number) => Math.min(4, Math.max(1, v));
  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (expandedIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (!hasMultiple) return;
      if (e.key === "ArrowLeft") {
        go(-1);
      }
      if (e.key === "ArrowRight") {
        go(1);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expandedIdx, close, hasMultiple, go]);

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
            swiped.current = false;
            if (e.touches.length === 2) {
              // Second finger down → pinch takes over, photo swipe stands down.
              const a = e.touches[0], b = e.touches[1];
              pinchStart.current = {
                dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                zoom,
              };
              panStart.current = null;
              touchStart.current = null;
              return;
            }
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            if (zoom > 1) {
              panStart.current = { x: t.clientX, y: t.clientY, px: pan.x, py: pan.y };
            } else if (t) {
              touchStart.current = { x: t.clientX, y: t.clientY };
            }
          }}
          onTouchMove={(e) => {
            if (pinchStart.current && e.touches.length === 2) {
              const a = e.touches[0], b = e.touches[1];
              const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
              if (pinchStart.current.dist > 0 && dist > 0) {
                applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist));
              }
              return;
            }
            const ps = panStart.current;
            if (ps && e.touches.length === 1) {
              const t = e.touches[0];
              const dx = t.clientX - ps.x, dy = t.clientY - ps.y;
              if (Math.abs(dx) + Math.abs(dy) > 12) swiped.current = true;
              const max = 240 * zoom;
              setPan({
                x: Math.min(max, Math.max(-max, ps.px + dx)),
                y: Math.min(max, Math.max(-max, ps.py + dy)),
              });
            }
          }}
          onTouchEnd={(e) => {
            pinchStart.current = null;
            panStart.current = null;
            const start = touchStart.current;
            touchStart.current = null;
            if (!start || !hasMultiple || zoom > 1) return;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            // Horizontal swipe wins over vertical drift: finger left → next,
            // finger right → previous.
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              swiped.current = true;
              go(dx < 0 ? 1 : -1);
            }
          }}
          onWheel={(e) => {
            applyZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
          }}
        >
          {/* Gallery fullscreen: the whole image always fits on open
              (contain); pinch/wheel zooms into details, drag pans while
              zoomed. Overlay minimize + single download icon. Tap empty
              area to minimize. */}
          <img
            key={expandedIdx}
            src={expandedSrc}
            alt="Expanded attachment"
            className={`msg-gallery-full-img${slideDir === 1 ? " msg-gallery-slide-next" : slideDir === -1 ? " msg-gallery-slide-prev" : ""}`}
            style={
              zoom === 1
                ? undefined
                : { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: "grab" }
            }
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
