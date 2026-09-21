import { useRef, useState } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
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
  brightness: number;
  onBrightnessChange: (value: number) => void;
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
}

/**
 * In-app camera viewfinder: half-height panel just below the input card.
 * No visible sliders — invisible gestures on the viewfinder:
 * horizontal slide = zoom (left→right zooms in, right→left zooms out),
 * vertical slide = brightness (up brighter, down darker).
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
  brightness,
  onBrightnessChange,
  torchSupported,
  torchOn,
  onToggleTorch,
}: CameraViewProps) => {
  const gestureRef = useRef<{
    x: number;
    y: number;
    zoom: number;
    brightness: number;
  } | null>(null);
  const [gestureBadge, setGestureBadge] = useState<string | null>(null);
  const badgeTimer = useRef<number | null>(null);

  if (!open) return null;

  const flashBadge = (text: string) => {
    setGestureBadge(text);
    if (badgeTimer.current !== null) window.clearTimeout(badgeTimer.current);
    badgeTimer.current = window.setTimeout(() => setGestureBadge(null), 1100);
  };

  const clampZoom = (v: number) =>
    zoomRange ? Math.min(zoomRange.max, Math.max(zoomRange.min, v)) : v;
  const clampBrightness = (v: number) =>
    Math.min(2, Math.max(0.3, Math.round(v * 100) / 100));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    gestureRef.current = {
      x: e.clientX,
      y: e.clientY,
      zoom,
      brightness,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || !e.isPrimary || e.buttons === 0) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return; // dead zone
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal: left→right zooms in, right→left zooms out.
      if (!zoomRange) return;
      const width = e.currentTarget.clientWidth || 300;
      const next = clampZoom(
        g.zoom + (dx / width) * (zoomRange.max - zoomRange.min)
      );
      onZoomChange(next);
      flashBadge(`${next.toFixed(1)}x`);
    } else {
      // Vertical: up brightens, down darkens.
      const next = clampBrightness(g.brightness - dy / 250);
      onBrightnessChange(next);
      flashBadge(`Brightness ${next.toFixed(2)}`);
    }
  };

  const endGesture = () => {
    gestureRef.current = null;
  };

  return (
    <div className="composer-camera-view">
      <div
        className="composer-camera-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={endGesture}
      >
        {error ? (
          <div className="composer-camera-error">{error}</div>
        ) : (
          <video
            ref={videoRef}
            className="composer-camera-video"
            style={
              brightness !== 1
                ? { filter: `brightness(${brightness})` }
                : undefined
            }
            autoPlay
            playsInline
            muted
          />
        )}
        {gestureBadge && (
          <div className="composer-camera-gesture-badge" aria-hidden="true">
            {gestureBadge}
          </div>
        )}
      </div>
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
