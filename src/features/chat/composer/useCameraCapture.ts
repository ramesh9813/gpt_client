import { useEffect, useRef, useState } from "react";

interface CameraCaptureOptions {
  onFiles: (files: FileList) => void;
}

/**
 * In-app camera (getUserMedia viewfinder + JPEG capture).
 * Split from Composer.tsx. No logic changes.
 */
export const useCameraCapture = ({ onFiles }: CameraCaptureOptions) => {
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
    const [zoom, setZoomState] = useState(1);
    // Software brightness (preview filter + baked into captures). Works on
    // every device, unlike the rarely-supported hardware constraint.
    const [brightness, setBrightnessState] = useState(1);
    const brightnessRef = useRef(1);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);

    useEffect(() => {
      if (!cameraOpen) return;
      let cancelled = false;
      const stopStream = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      (async () => {
        setCameraError(null);
        try {
          stopStream();
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("unsupported");
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          const caps = (track?.getCapabilities?.() ?? {}) as {
            zoom?: { min?: number; max?: number; step?: number };
            torch?: boolean;
          };
          if (caps.zoom && typeof caps.zoom.max === "number" && caps.zoom.max > 1) {
            setZoomRange({
              min: caps.zoom.min ?? 1,
              max: caps.zoom.max,
              step: caps.zoom.step ?? 0.1,
            });
          } else {
            setZoomRange(null);
          }
          setZoomState(1);
          setTorchSupported(caps.torch === true);
          setTorchOn(false);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
        } catch {
          if (!cancelled) {
            setCameraError("Could not access the camera. Allow permission and retry.");
          }
        }
      })();
      return () => {
        cancelled = true;
        stopStream();
        if (videoRef.current) videoRef.current.srcObject = null;
      };
    }, [cameraOpen, facingMode]);

    const setZoomLevel = (next: number) => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || !zoomRange) return;
      const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, next));
      track
        .applyConstraints({ advanced: [{ zoom: clamped } as any] })
        .then(() => setZoomState(clamped))
        .catch(() => {
          // ignore: device rejected the zoom level
        });
    };

    const toggleTorch = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || !torchSupported) return;
      const next = !torchOn;
      track
        .applyConstraints({ advanced: [{ torch: next } as any] })
        .then(() => setTorchOn(next))
        .catch(() => {
          // ignore: device rejected torch toggle
        });
    };

    const setBrightness = (next: number) => {
      const clamped = Math.min(2, Math.max(0.3, Math.round(next * 100) / 100));
      brightnessRef.current = clamped;
      setBrightnessState(clamped);
    };

    const handleCapturePhoto = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Bake the preview brightness into the file (CSS filters don't
      // affect drawImage, so the canvas filter does it explicitly).
      try {
        ctx.filter = `brightness(${brightnessRef.current})`;
      } catch {
        // older canvas implementations ignore filter — capture unfiltered
      }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const dt = new DataTransfer();
          dt.items.add(file);
          void onFilesRef.current(dt.files);
        },
        "image/jpeg",
        0.92
      );
    };

  return {
    videoRef,
    cameraOpen,
    setCameraOpen,
    cameraError,
    facingMode,
    setFacingMode,
    handleCapturePhoto,
    zoomRange,
    zoom,
    setZoomLevel,
    brightness,
    setBrightness,
    torchSupported,
    torchOn,
    toggleTorch,
  };
};

export type CameraCaptureApi = ReturnType<typeof useCameraCapture>;
