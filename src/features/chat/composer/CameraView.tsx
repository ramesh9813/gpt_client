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
      <div className="composer-camera-bar">
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
