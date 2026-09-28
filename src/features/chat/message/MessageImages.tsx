import { useEffect, useState, useCallback } from "react";

export const MessageImages = ({ images }: { images?: string[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const isSingle = images?.length === 1;

  const close = useCallback(() => setExpanded(null), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded, close]);

  if (!images || images.length === 0) return null;
  return (
    <>
      <div className={`msg-images${isSingle ? " msg-images--single" : ""}`}>
        {images.map((src, i) => (
          <div
            key={i}
            className={`msg-image-wrap${isSingle ? " msg-image-wrap--single" : " msg-image-wrap--expandable"}`}
          >
            <img
              src={src}
              alt={`Attachment ${i + 1}`}
              loading="lazy"
              className={`msg-image${isSingle ? " msg-image--single" : ""}`}
              onClick={() => setExpanded(src)}
              style={{ cursor: "zoom-in" }}
              decoding="async"
            />
            <button
              type="button"
              className="msg-image-expand"
              onClick={() => setExpanded(src)}
              aria-label="Expand image"
              title="Expand"
            >
              <i className="bi bi-arrows-angle-expand" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {expanded && (
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
          {/* stopPropagation so clicking the image itself does not bubble twice, but backdrop still closes */}
          <img
            src={expanded}
            alt="Expanded attachment"
            className="msg-image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
