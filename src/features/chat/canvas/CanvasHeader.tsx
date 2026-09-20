type CanvasHeaderProps = {
  blockCount: number;
  onClose?: () => void;
};

export const CanvasHeader = ({ blockCount, onClose }: CanvasHeaderProps) => {
  return (
    <div className="canvas-header">
      <div className="canvas-title-wrap">
        <div className="canvas-title">Canvas</div>
        <div className="canvas-subtitle">{blockCount} blocks</div>
      </div>
      {onClose ? (
        <button
          onClick={onClose}
          className="canvas-close-btn"
          title="Close canvas"
          type="button"
        >
          <i className="bi bi-x-lg canvas-close-icon"></i>
        </button>
      ) : null}
    </div>
  );
};

export default CanvasHeader;
