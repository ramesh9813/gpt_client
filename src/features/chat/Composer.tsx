import "./Composer.css";
import { KeyboardEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ImageAttachments } from "./composer/ImageAttachments";
import { RecentTray } from "./composer/RecentTray";
import "./composer/RecentTray.css";
import { ModelMenu } from "./composer/ModelMenu";
import type { ModelOption, SortOption } from "./composer/ModelMenu";
import { useComposerImages } from "./composer/useComposerImages";

export type { ModelOption, SortOption };

export type ComposerProps = {
  // images?:string[] is optional → backward compat with (value: string) => void
  onSend: (value: string, images?: string[], opts?: { research?: boolean }) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  error?: string | null;
  lastUserMessage?: string;
  model: string;
  modelOptions: ModelOption[];
  modelsLoading?: boolean;
  onModelChange: (value: string) => void;
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
};

const Composer = ({
  onSend,
  onStop,
  disabled,
  streaming,
  error,
  lastUserMessage,
  model,
  modelOptions,
  modelsLoading,
  onModelChange,
  inputRef,
  sort = "name",
  onSortChange
}: ComposerProps) => {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Armed when the user picks a model from the Deep Research list.
  const [researchArmed, setResearchArmed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRecents, setShowRecents] = useState(false);
  const { images, compressing, fileInputRef, handleFiles, removeImage, clearImages, recents, attachRecent } =
    useComposerImages();

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
        void handleFiles(dt.files);
      },
      "image/jpeg",
      0.92
    );
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen]);

  const canSend = value.trim().length > 0 || images.length > 0;

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && images.length === 0) return;
    if (compressing) return;
    onSend(trimmed, images.length > 0 ? [...images] : undefined, researchArmed ? { research: true } : undefined);
    setValue("");
    setShowRecents(false);
    // One-shot: disarm research mode after sending.
    setResearchArmed(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) adjustTextareaHeight(el);
    });
    clearImages();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !streaming && !compressing) {
        handleSend();
      }
    }
  };

  const handleEditLast = () => {
    if (!lastUserMessage) return;
    setValue(lastUserMessage);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const setTextareaRefs = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (inputRef) {
      inputRef.current = node;
    }
    if (node) adjustTextareaHeight(node);
  };

  // Single row initially, grow line-by-line up to 4 rows, then scroll inside.
  const adjustTextareaHeight = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 24;
    const padding =
      (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const maxHeight = Math.round(lineHeight * 4 + padding);
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) adjustTextareaHeight(el);
  }, [value]);

  const currentModelLabel =
    modelOptions.find((o) => o.value === model)?.label || "Model";

  // Keep hidden to satisfy TS noUnusedLocals if edit-last shortcut is wired elsewhere.
  void handleEditLast;

  return (
    <div className="composer-dock">
      <div className="composer-input-container">
        {/* Image preview strip */}
        <ImageAttachments images={images} compressing={compressing} onRemove={removeImage} />

        {/* Armed research mode indicator */}
        {researchArmed && (
          <div className="composer-research-chip">
            <i className="bi bi-compass composer-research-icon" aria-hidden="true"></i>
            <span className="composer-research-label" title={currentModelLabel}>
              Deep Research • {currentModelLabel}
            </span>
            <button
              type="button"
              className="composer-research-clear"
              onClick={() => setResearchArmed(false)}
              aria-label="Cancel deep research"
              title="Cancel deep research"
            >
              <i className="bi bi-x" aria-hidden="true"></i>
            </button>
          </div>
        )}

        <div className="composer-body">
          <textarea
            ref={setTextareaRefs}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustTextareaHeight(e.target);
            }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
                if (imgs.length > 0) {
                  e.preventDefault();
                  const dt = new DataTransfer();
                  imgs.forEach((f) => dt.items.add(f));
                  void handleFiles(dt.files);
                }
              }
            }}
            placeholder="Send a message"
            className="composer-textarea"
          />

          <div className="composer-toolbar">
          <div className="composer-menu-root" ref={menuRef}>
            <Button
              variant="ghost"
              className="composer-menu-btn"
              disabled={disabled}
              aria-label="More options"
              title="More options"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                if (menuOpen) setModelMenuOpen(false);
              }}
              type="button"
            >
              <i className={`bi ${menuOpen ? "bi-x-lg composer-menu-icon-close" : "bi-plus-lg composer-menu-icon-open"}`} aria-hidden="true" />
            </Button>

            {/* Options Menu */}
            {menuOpen && (
              <ModelMenu
                model={model}
                modelOptions={modelOptions}
                modelsLoading={modelsLoading}
                sort={sort}
                onSortChange={onSortChange}
                onModelChange={onModelChange}
                currentModelLabel={currentModelLabel}
                modelMenuOpen={modelMenuOpen}
                menuOpen={menuOpen}
                onModelMenuOpenChange={setModelMenuOpen}
                onCloseMenu={() => setMenuOpen(false)}
                onResearchSelect={() => setResearchArmed(true)}
              />
            )}
          </div>

          {/* Upload photo button */}
          <Button
            variant="ghost"
            className="composer-upload-btn"
            disabled={disabled || compressing}
            aria-label="Upload image"
            title="Upload image"
            onClick={() => {
              if (recents.length === 0) {
                fileInputRef.current?.click();
              } else {
                setShowRecents((prev) => !prev);
              }
            }}
            type="button"
          >
            <i className="bi bi-image composer-upload-icon" aria-hidden="true" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Take photo button — opens the in-app camera below */}
          <Button
            variant="ghost"
            className="composer-upload-btn"
            disabled={disabled || compressing}
            aria-label={cameraOpen ? "Close camera" : "Take photo"}
            title={cameraOpen ? "Close camera" : "Take photo"}
            onClick={() => setCameraOpen((prev) => !prev)}
            type="button"
          >
            <i className={`bi ${cameraOpen ? "bi-camera-fill" : "bi-camera"} composer-upload-icon`} aria-hidden="true" />
          </Button>

          <button
            type="button"
            className="composer-model-tag"
            title={currentModelLabel}
            aria-label={`Selected model: ${currentModelLabel}. Change model`}
            aria-haspopup="dialog"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setMenuOpen(true);
              setModelMenuOpen(true);
            }}
          >
            {currentModelLabel}
          </button>

            <div className="composer-spacer" />
          {streaming ? (
            <Button
              onClick={onStop}
              variant="ghost"
              className="composer-stop-btn"
              aria-label="Stop response"
              title="Stop response"
            >
              <i className="bi bi-stop-circle-fill composer-stop-icon" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={disabled || !canSend || compressing}
              variant="ghost"
              className={`composer-send-btn ${
                canSend ? "composer-send-btn-ready" : "composer-send-btn-idle"
              }`}
              aria-label="Send message"
              title="Send message"
            >
              <i className="bi bi-arrow-up-circle-fill composer-send-icon" />
            </Button>
          )}
          </div>
        </div>
      </div>
      <RecentTray
        open={showRecents && recents.length > 0}
        recents={recents}
        attached={images}
        onPick={attachRecent}
        onBrowse={() => fileInputRef.current?.click()}
        onClose={() => setShowRecents(false)}
      />
      {error ? (
        <div className="composer-error">{error}</div>
      ) : null}
      {/* In-app camera viewfinder: half-height panel just below the input card */}
      {cameraOpen && (
        <div className="composer-camera-view">
          {cameraError ? (
            <div className="composer-camera-error">{cameraError}</div>
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
              onClick={() => setCameraOpen(false)}
              aria-label="Close camera"
              title="Close camera"
            >
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="composer-camera-shutter"
              onClick={handleCapturePhoto}
              disabled={!!cameraError}
              aria-label="Capture photo"
              title="Capture photo"
            >
              <i className="bi bi-circle" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              className="composer-camera-btn"
              onClick={() =>
                setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
              }
              aria-label="Switch camera"
              title="Switch camera"
            >
              <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Composer;
