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

    const handleCapturePhoto = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
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
  };
};

export type CameraCaptureApi = ReturnType<typeof useCameraCapture>;
