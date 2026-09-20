export const MessageImages = ({ images }: { images?: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <div className="msg-images">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Attachment ${i + 1}`}
          loading="lazy"
          className="msg-image"
        />
      ))}
    </div>
  );
};
