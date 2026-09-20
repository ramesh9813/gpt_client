import type { MutableRefObject } from "react";
import "./ComposerCamera.css";

export interface CameraViewProps {
  open: boolean;
  error: string | null;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onCapture: () => void;
  captureDisabled: boolean;
  onFlip: () => void;
  zoomRange: { min: number; max: number; step: number } | null;
  zoom: number;
  onZoomChange: (value: number) => void;
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
}

/**
 * In-app camera viewfinder: half-height panel just below the input card.
 * Split from Composer.tsx. No logic changes.
 */
export const CameraView = ({
  open,
  error,
  videoRef,
  onClose,
  onCapture,
  captureDisabled,
  onFlip,
  zoomRange,
  zoom,
  onZoomChange,
  torchSupported,
  torchOn,
  onToggleTorch,
}: CameraViewProps) => {
  if (!open) return null;
  return (
    <div className="composer-camera-view">
      {error ? (
        <div className="composer-camera-error">{error}</div>
      ) : (
        <video
          ref={videoRef}
          className="composer-camera-video"
          autoPlay
          playsInline
          muted
        />
      )}
      {zoomRange && (
        <div className="composer-camera-zoom" role="group" aria-label="Camera zoom">
          <button
            type="button"
            className="composer-camera-btn"
            onClick={() => onZoomChange(zoom - zoomRange.step * 5)}
            disabled={zoom <= zoomRange.min}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <i className="bi bi-dash-lg" aria-hidden="true"></i>
          </button>
          <input
            type="range"
            className="composer-camera-zoom-slider"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            aria-label={`Zoom ${zoom.toFixed(1)}x`}
          />
          <button
            type="button"
            className="composer-camera-btn"
            onClick={() => onZoomChange(zoom + zoomRange.step * 5)}
            disabled={zoom >= zoomRange.max}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
          </button>
          <span className="composer-camera-zoom-label" aria-hidden="true">
            {zoom.toFixed(1)}x
          </span>
        </div>
      )}
      <div className="composer-camera-bar">
        {torchSupported && (
          <button
            type="button"
            className="composer-camera-btn"
            onClick={onToggleTorch}
            aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            aria-pressed={torchOn}
            title={torchOn ? "Flashlight off" : "Flashlight on"}
          >
            <i className={`bi ${torchOn ? "bi-lightbulb-fill" : "bi-lightbulb"}`} aria-hidden="true"></i>
          </button>
        )}
        <button
          type="button"
          className="composer-camera-btn"
          onClick={onClose}
          aria-label="Close camera"
          title="Close camera"
        >
          <i className="bi bi-x-lg" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          className="composer-camera-shutter"
          onClick={onCapture}
          disabled={captureDisabled}
          aria-label="Capture photo"
          title="Capture photo"
        >
          <i className="bi bi-circle" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          className="composer-camera-btn"
          onClick={onFlip}
          aria-label="Switch camera"
          title="Switch camera"
        >
          <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
};
