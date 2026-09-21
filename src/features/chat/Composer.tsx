import "./Composer.css";
import { KeyboardEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { ImageAttachments } from "./composer/ImageAttachments";
import { RecentTray } from "./composer/RecentTray";
import "./composer/RecentTray.css";
import { ComposerToolbar } from "./composer/ComposerToolbar";
import { CameraView } from "./composer/CameraView";
import { ComposerStatus } from "./composer/ComposerStatus";
import type { ModelOption, SortOption } from "./composer/ModelMenu";
import { useComposerImages } from "./composer/useComposerImages";
import { useDeviceImages } from "./composer/useDeviceImages";
import { useVoiceInput } from "./composer/useVoiceInput";
import { useCameraCapture } from "./composer/useCameraCapture";

export type { ModelOption, SortOption };

export type ComposerProps = {
  // images?:string[] is optional → backward compat with (value: string) => void
  onSend: (value: string, images?: string[], opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean }) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  error?: string | null;
  lastUserMessage?: string;
  model: string;
  modelOptions: ModelOption[];
  modelsLoading?: boolean;
  modelsTotal?: number;
  modelsUpdatedAt?: string | null;
  modelsStale?: { offline: boolean; updatedAgo: string } | null;
  modelResetNotice?: string | null;
  onRefreshModels?: () => void;
  modelsRefreshing?: boolean;
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
  modelsTotal,
  modelsUpdatedAt,
  modelsStale,
  modelResetNotice,
  onRefreshModels,
  modelsRefreshing,
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
  // Armed when the user picks Artifact / Simulation from the '+' menu.
  // Mirrors researchArmed exactly: chip indicator, send opts, one-shot disarm.
  const [artifactArmed, setArtifactArmed] = useState(false);
  // Armed when the user toggles the globe button: this turn gets the
  // OpenRouter web_search server tool. Same one-shot pattern.
  const [webSearchArmed, setWebSearchArmed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRecents, setShowRecents] = useState(false);
  const { images, compressing, fileInputRef, handleFiles, removeImage, clearImages, recentPhotos, recentScreenshots, attachRecent } =
    useComposerImages();
  const {
    devicePhotos,
    deviceScreenshots,
    deviceStatus,
    photoFolderName,
    shotsFolderName,
    scanInfo,
    ensureDeviceImages,
    pickFolder,
  } = useDeviceImages();

  // Auto-load granted folders on every reload: silent attempt at mount, and
  // a gesture-backed re-confirm whenever the card opens (re-confirms dormant
  // grants with just the permission chip — never a folder re-pick).
  useEffect(() => {
    void ensureDeviceImages(false);
  }, [ensureDeviceImages]);
  useEffect(() => {
    if (showRecents) void ensureDeviceImages(true);
  }, [showRecents, ensureDeviceImages]);

  // Device rows serve blob: URLs — convert back to a File so attach/send
  // flows keep working on real compressed dataURLs.
  const handlePickSrc = (src: string) => {
    if (!src.startsWith("blob:")) {
      attachRecent(src);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) return;
        const file = new File([blob], `device-photo-${Date.now()}.jpg`, {
          type: blob.type,
        });
        const dt = new DataTransfer();
        dt.items.add(file);
        await handleFiles(dt.files, "photo");
      } catch {
        // unreadable blob — ignore
      }
    })();
  };

  const { listening, listenError, speechSupported, startListening, stopListening } =
    useVoiceInput({
      disabled,
      streaming,
      compressing,
      onTranscript: (text) => {
        setValue(text);
      },
    });
  const {
    videoRef,
    cameraOpen,
    setCameraOpen,
    cameraError,
    setFacingMode,
    handleCapturePhoto,
    zoomRange,
    zoom,
    setZoomLevel,
    torchSupported,
    torchOn,
    toggleTorch,
  } = useCameraCapture({
    onFiles: (files) => {
      void handleFiles(files, "photo");
    },
  });



  const canSend = value.trim().length > 0 || images.length > 0;

  const handleSend = () => sendText(value);

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    if (compressing) return;
    const opts =
      researchArmed || artifactArmed || webSearchArmed
        ? {
            ...(researchArmed ? { research: true as const } : {}),
            ...(artifactArmed ? { artifact: true as const } : {}),
            ...(webSearchArmed ? { webSearch: true as const } : {}),
          }
        : undefined;
    onSend(trimmed, images.length > 0 ? [...images] : undefined, opts);
    setValue("");
    setShowRecents(false);
    // One-shot: disarm research + artifact + web-search modes after sending.
    setResearchArmed(false);
    setArtifactArmed(false);
    setWebSearchArmed(false);
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

  // MCQ quiz shortcut: insert "mcq " prefix so the server routes to quiz.
  // Never auto-sends — the user reviews/edits the topic, then hits Send.
  const handleQuizPrefix = () => {
    const el = textareaRef.current;
    if (/^\s*mcq(\s|$)/i.test(value)) {
      requestAnimationFrame(() => el?.focus());
      return;
    }
    const stripped = value.replace(/^\s+/, "");
    const next = stripped ? `mcq ${stripped}` : "mcq ";
    setValue(next);
    requestAnimationFrame(() => {
      if (el) {
        adjustTextareaHeight(el);
        el.focus();
        try {
          el.selectionStart = el.selectionEnd = next.length;
        } catch {
          // ignore selection errors (non-text inputs never occur here)
        }
      }
    });
  };

  return (
    <div className="composer-dock">
      <div className="composer-input-container">
        {/* Image preview strip */}
        <ImageAttachments images={images} compressing={compressing} onRemove={removeImage} />

        <ComposerStatus
          researchArmed={researchArmed}
          currentModelLabel={currentModelLabel}
          onClearResearch={() => setResearchArmed(false)}
          artifactArmed={artifactArmed}
          onClearArtifact={() => setArtifactArmed(false)}
          webSearchArmed={webSearchArmed}
          onClearWebSearch={() => setWebSearchArmed(false)}
          listening={listening}
          error={error}
          listenError={listenError}
        />

        <div className="composer-body">
          <textarea
            ref={setTextareaRefs}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustTextareaHeight(e.target);
              // Typing takes over: auto-close the camera view and the
              // image-selector card so the thread gets full space.
              if (e.target.value.length > 0) {
                setCameraOpen(false);
                setShowRecents(false);
              }
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
                  void handleFiles(dt.files, "screenshot");
                }
              }
            }}
            placeholder="Send a message"
            className="composer-textarea"
          />

          <ComposerToolbar
            menuOpen={menuOpen}
            onToggleMenu={() => {
              setMenuOpen((prev) => !prev);
              if (menuOpen) setModelMenuOpen(false);
            }}
            modelMenuOpen={modelMenuOpen}
            onModelMenuOpenChange={setModelMenuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            menuRef={menuRef}
            model={model}
            modelOptions={modelOptions}
            modelsLoading={modelsLoading}
            modelsTotal={modelsTotal}
            modelsUpdatedAt={modelsUpdatedAt}
            modelsStale={modelsStale}
            modelResetNotice={modelResetNotice}
            onRefreshModels={onRefreshModels}
            modelsRefreshing={modelsRefreshing}
            sort={sort}
            onSortChange={onSortChange}
            onModelChange={onModelChange}
            currentModelLabel={currentModelLabel}
            onResearchSelect={() => setResearchArmed(true)}
            onArtifactSelect={() => setArtifactArmed(true)}
            researchArmed={researchArmed}
            artifactArmed={artifactArmed}
            webSearchArmed={webSearchArmed}
            onWebSearchToggle={() => setWebSearchArmed((prev) => !prev)}
            disabled={disabled}
            compressing={compressing}
            hasRecents={recentPhotos.length + recentScreenshots.length > 0}
            fileInputRef={fileInputRef}
            onFiles={(files) => {
              void handleFiles(files, "photo");
            }}
            onToggleRecents={() => setShowRecents((prev) => !prev)}
            cameraOpen={cameraOpen}
            onCameraToggle={() => setCameraOpen((prev) => !prev)}
            onQuizClick={handleQuizPrefix}
            listening={listening}
            speechSupported={speechSupported}
            onMicClick={() => (listening ? stopListening() : startListening())}
            canSend={canSend}
            streaming={streaming}
            onStop={onStop}
            onSend={() => handleSend()}
          />
        </div>
      </div>
      <RecentTray
        open={showRecents}
        recentPhotos={recentPhotos}
        recentScreenshots={recentScreenshots}
        devicePhotos={devicePhotos}
        deviceScreenshots={deviceScreenshots}
        deviceStatus={deviceStatus}
        photoFolderName={photoFolderName}
        shotsFolderName={shotsFolderName}
        photoScan={scanInfo.photos}
        shotsScan={scanInfo.screenshots}
        onPickPhotosFolder={() => pickFolder("photos")}
        onPickScreenshotsFolder={() => pickFolder("screenshots")}
        attached={images}
        onPick={handlePickSrc}
        onBrowse={() => fileInputRef.current?.click()}
        onClose={() => setShowRecents(false)}
      />
      <CameraView
        open={cameraOpen}
        error={cameraError}
        videoRef={videoRef}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapturePhoto}
        captureDisabled={!!cameraError}
        onFlip={() =>
          setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
        }
        zoomRange={zoomRange}
        zoom={zoom}
        onZoomChange={setZoomLevel}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
      />
    </div>
  );
};

export default Composer;
