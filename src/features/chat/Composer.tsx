import "./Composer.css";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { ImageAttachments } from "./composer/ImageAttachments";
import { RecentTray } from "./composer/RecentTray";
import "./composer/RecentTray.css";
import { ComposerToolbar } from "./composer/ComposerToolbar";
import { CameraView } from "./composer/CameraView";
import { ComposerStatus } from "./composer/ComposerStatus";
import type { ModelOption, SortOption } from "./composer/ModelMenu";
import { useComposerImages } from "./composer/useComposerImages";
import { useDeviceImages } from "./composer/useDeviceImages";
import { requestListScroll, subscribeListScrollState, type ListScrollState } from "./messagelist/scrollBus";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useCameraCapture } from "./composer/useCameraCapture";
import { useComposerArmed, useComposerText } from "./composer/useComposerText";
import { useComposerFiles } from "./composer/useComposerFiles";
import FileAttachments from "./composer/FileAttachments";
import {
  estimateTokens,
  estimateTurnChars,
  formatTokenCount,
  isNearLimit,
  providerInputLimit,
} from "../../lib/tokens";
import { getActiveByok, subscribeByok } from "../../lib/byok";


export type { ModelOption, SortOption };

import type { FileAttachment } from "../../lib/fileChat";

export type ComposerProps = {
  // images/files optional → backward compat
  onSend: (value: string, images?: string[], opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean; think?: boolean; files?: FileAttachment[] }) => void;
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
  activeProviderId?: string | null;
  onProviderModelChange?: (providerId: string, model: string) => void;
  isGeneralUser?: boolean;
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  // Thread size for the live token estimate (sum of message content chars).
  historyChars?: number;
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
  activeProviderId,
  onProviderModelChange,
  isGeneralUser,
  inputRef,
  sort = "name",
  onSortChange,
  historyChars = 0
}: ComposerProps) => {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // Single smart jump button: state pushed by the message list. Hidden while
  // parked at the bottom of the chat; arrow follows scroll intent (up when the
  // user is scrolling up, down otherwise / from the top edge).
  const [scrollState, setScrollState] = useState<ListScrollState>({
    atBottom: true,
    atTop: true,
    canScroll: false,
    lastDir: "down",
  });
  useEffect(() => subscribeListScrollState(setScrollState), []);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const {
    researchArmed,
    setResearchArmed,
    artifactArmed,
    setArtifactArmed,
    webSearchArmed,
    setWebSearchArmed,
    mcqArmed,
    setMcqArmed,
    thinkingArmed,
    setThinkingArmed,
    trimArmed,
    setTrimArmed,
  } = useComposerArmed();
  // Active provider for the live token estimate (re-read on BYOK changes).
  const [byokTick, setByokTick] = useState(0);
  useEffect(() => subscribeByok(() => setByokTick((t) => t + 1)), []);
  void byokTick;
  const estimateProviderId = getActiveByok()?.provider ?? null;
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRecents, setShowRecents] = useState(false);

  // Auto-collapse the '+' options card on outside click/tap, outer scroll,
  // or Escape. UI-only: never touches send/model/selection logic.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => {
      setMenuOpen(false);
      setModelMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const { images, compressing, fileInputRef, handleFiles, removeImage, clearImages, recentPhotos, recentScreenshots, attachRecent } =
    useComposerImages();
  const { files, fileError, reading: fileReading, filePickRef, addFiles, removeFile, clearFiles, setFileError } =
    useComposerFiles();
  const {
    devicePhotos,
    deviceScreenshots,
    deviceStatus,
    photoFolderName,
    shotsFolderName,
    scanInfo,
    ensureDeviceImages,
    pickFolder,
    refreshDeviceImages,
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

  // Record-then-transcribe (on-device Whisper): tap mic → RECORDING,
  // tap mic again → PROCESSING (whole clip decoded + transcribed), then the
  // full transcript lands in the textarea for review before send.
  const {
    phase: voicePhase,
    progress: voiceProgress,
    error: voiceError,
    supported: speechSupported,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceInput({
    disabled,
    streaming,
    compressing,
    onTranscript: (text) => {
      setValue(text);
    },
    // Live chunks while PROCESSING: append each finished slice, keep past text.
    onPartialTranscript: (text) => {
      setValue((prev) => (prev ? `${prev} ${text}` : text));
    },
  });
  const voiceRecording = voicePhase === "recording";
  const voiceProcessing =
    voicePhase === "processing" || voicePhase === "loading";
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
    brightness,
    setBrightness,
    torchSupported,
    torchOn,
    toggleTorch,
  } = useCameraCapture({
    onFiles: (files) => {
      void handleFiles(files, "photo");
    },
  });



  const {
    textareaRef,
    canSend: textCanSend,
    handleSend: baseHandleSend,
    onKeyDown,
    handleEditLast,
    setTextareaRefs,
    handleChange,
    handlePaste,
    handlePickSrc,
  } = useComposerText({
    value,
    setValue,
    images,
    compressing,
    mcqArmed,
    researchArmed,
    artifactArmed,
    webSearchArmed,
    thinkingArmed,
    disabled,
    streaming,
    lastUserMessage,
    inputRef,
    onSend: (v, imgs, opts) => {
      const payloadFiles = files.length > 0 ? [...files] : undefined;
      (onSend as any)(v, imgs, payloadFiles ? { ...opts, files: payloadFiles } : opts);
      if (payloadFiles) clearFiles();
    },
    clearImages,
    handleFiles,
    attachRecent,
    setShowRecents,
    setCameraOpen,
    setResearchArmed,
    setArtifactArmed,
  });
  const canSend = textCanSend || files.length > 0;
  const handleSend = () => {
    if (!canSend || fileReading) return;
    baseHandleSend();
  };

  // Live token estimate: capped history + current input + file payload +
  // system headroom, at ~4 chars/token. Warns near the provider cap and
  // flags when auto-trim will clamp history on send.
  const filesChars = files.reduce((n, f) => n + (f.content?.length ?? 0), 0);
  const estimateInputChars = value.length;
  const estimateNear = isNearLimit({
    historyChars,
    inputChars: estimateInputChars,
    filesChars,
    providerId: estimateProviderId,
  });
  const estimateChars = estimateTurnChars({
    historyChars,
    inputChars: estimateInputChars,
    filesChars,
    providerId: estimateProviderId,
  });
  const estimateCount = estimateTokens(estimateChars);
  const estimateLimit = providerInputLimit(estimateProviderId);
  const estimateLeft =
    estimateLimit !== undefined
      ? Math.max(0, estimateLimit - estimateCount)
      : null;
  const tokenLineState =
    estimateNear && !trimArmed ? "composer-token-line--over" : "";
  const tokenLineTitle =
    estimateLimit !== undefined
      ? `Estimated request size vs this provider's ${formatTokenCount(estimateLimit)}-token input limit`
      : "Estimated request size for this turn";
  const tokenLineInner = (
    <>
      <span>~{formatTokenCount(estimateCount)} tokens</span>
      {estimateLeft !== null && (
        <span> • {formatTokenCount(estimateLeft)} left</span>
      )}
      {estimateNear && trimArmed && <span> • auto-trim on</span>}
      {estimateNear && !trimArmed && <span> • over limit!</span>}
    </>
  );

  const currentModelLabel =
    modelOptions.find((o) => o.value === model)?.label || "Model";

  // Keep hidden to satisfy TS noUnusedLocals if edit-last shortcut is wired elsewhere.
  void handleEditLast;

  // Sticky quiz mode lives in mcqArmed (chip + auto-prefix on send), so no
  // manual prefix juggling here.

  return (
    <div className="composer-dock">
      <div className="composer-input-container">
        {/* Single smart jump button, pinned above the input card: hidden when
            already parked at the bottom; direction follows scroll intent. */}
        {scrollState.canScroll && !scrollState.atBottom && (
          <div className="composer-scroll-pin" role="toolbar" aria-label="Scroll chat">
            <button
              type="button"
              className="msg-jump-btn"
              onClick={() =>
                requestListScroll(
                  !scrollState.atTop && scrollState.lastDir === "up"
                    ? "top"
                    : "bottom"
                )
              }
              title={
                !scrollState.atTop && scrollState.lastDir === "up"
                  ? "Scroll to top"
                  : "Scroll to bottom"
              }
              aria-label={
                !scrollState.atTop && scrollState.lastDir === "up"
                  ? "Scroll to top"
                  : "Scroll to bottom"
              }
            >
              <i
                className={`bi ${
                  !scrollState.atTop && scrollState.lastDir === "up"
                    ? "bi-arrow-up"
                    : "bi-arrow-down"
                } msg-jump-icon`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
        {/* Image preview strip */}
        <ImageAttachments images={images} compressing={compressing} onRemove={removeImage} />
        <FileAttachments files={files} reading={fileReading} fileError={fileError} onRemove={removeFile} onClearError={() => setFileError(null)} />
        <input ref={filePickRef} type="file" multiple hidden aria-hidden="true" tabIndex={-1} onChange={(e) => void addFiles(e.target.files)} />

        <ComposerStatus
          listening={voiceRecording}
          processing={voiceProcessing}
          progress={voiceProgress}
          error={error}
          listenError={voiceError}
        />

        {estimateCount > 0 && (
          <div
            className={`composer-token-line composer-token-line--standalone ${tokenLineState}`}
            title={tokenLineTitle}
          >
            {tokenLineInner}
          </div>
        )}

        <div className="composer-body">
          <textarea
            ref={setTextareaRefs}
            rows={1}
            value={value}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            placeholder="Send a message"
            className="composer-textarea"
          />

          <ComposerToolbar
            menuOpen={menuOpen}
            onToggleMenu={() => {
              setMenuOpen((prev) => !prev);
              if (menuOpen) setModelMenuOpen(false);
            }}
            onFilePick={() => filePickRef.current?.click()}
            modelMenuOpen={modelMenuOpen}
            onModelMenuOpenChange={setModelMenuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            menuRef={menuRef}
            model={model}
            modelOptions={modelOptions}
            isGeneralUser={isGeneralUser}
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
            activeProviderId={activeProviderId}
            onProviderModelChange={onProviderModelChange}
            currentModelLabel={currentModelLabel}
            onResearchSelect={() => setResearchArmed(true)}
            onArtifactSelect={() => setArtifactArmed(true)}
            researchArmed={researchArmed}
            artifactArmed={artifactArmed}
            onResearchDisarm={() => setResearchArmed(false)}
            onArtifactDisarm={() => setArtifactArmed(false)}
            webSearchArmed={webSearchArmed}
            onWebSearchToggle={() => setWebSearchArmed((prev) => !prev)}
            thinkingArmed={thinkingArmed}
            onThinkingToggle={() => setThinkingArmed((prev) => !prev)}
            trimArmed={trimArmed}
            onTrimToggle={() => setTrimArmed((prev) => !prev)}
            tokenInline={estimateCount > 0 ? tokenLineInner : undefined}
            tokenInlineState={tokenLineState}
            tokenInlineTitle={tokenLineTitle}
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
            mcqArmed={mcqArmed}
            onQuizClick={() => setMcqArmed((prev) => !prev)}
            listening={voiceRecording}
            processing={voiceProcessing}
            speechSupported={speechSupported}
            onMicClick={() =>
              voiceRecording
                ? void stopVoice()
                : voicePhase === "idle"
                  ? void startVoice()
                  : undefined
            }
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
        onRefreshPhotos={() => void refreshDeviceImages("photos")}
        onRefreshScreenshots={() => void refreshDeviceImages("screenshots")}
        refreshing={deviceStatus === "loading"}
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
        brightness={brightness}
        onBrightnessChange={setBrightness}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
      />
    </div>
  );
};

export default Composer;
