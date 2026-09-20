type ImageAttachmentsProps = {
  images: string[];
  compressing: boolean;
  onRemove: (index: number) => void;
};

export const ImageAttachments = ({ images, compressing, onRemove }: ImageAttachmentsProps) => {
  if (images.length === 0) return null;
  return (
    <div className="composer-image-strip">
      {images.map((src, idx) => (
        <div key={idx} className="composer-image-item">
          <img
            src={src}
            alt={`Upload ${idx + 1}`}
            loading="lazy"
            className="composer-image-img"
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label={`Remove image ${idx + 1}`}
            title="Remove image"
            className="composer-image-remove"
          >
            <i className="bi bi-x composer-image-remove-icon" aria-hidden="true" />
          </button>
        </div>
      ))}
      {compressing && (
        <span className="composer-compress-label">
          <i className="bi bi-hourglass-split composer-compress-icon" aria-hidden="true" />
          Compressing…
        </span>
      )}
    </div>
  );
};

export default ImageAttachments;
