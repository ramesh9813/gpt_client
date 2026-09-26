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
import { useVoiceInput } from "./composer/useVoiceInput";
import { useCameraCapture } from "./composer/useCameraCapture";
import { useComposerArmed, useComposerText } from "./composer/useComposerText";


export type { ModelOption, SortOption };

export type ComposerProps = {
  // images?:string[] is optional → backward compat with (value: string) => void
  onSend: (value: string, images?: string[], opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean; think?: boolean }) => void;
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
  } = useComposerArmed();
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
    canSend,
    handleSend,
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
    onSend,
    clearImages,
    handleFiles,
    attachRecent,
    setShowRecents,
    setCameraOpen,
    setResearchArmed,
    setArtifactArmed,
  });

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

        <ComposerStatus
          researchArmed={researchArmed}
          currentModelLabel={currentModelLabel}
          onClearResearch={() => setResearchArmed(false)}
          artifactArmed={artifactArmed}
          onClearArtifact={() => setArtifactArmed(false)}
          webSearchArmed={webSearchArmed}
          onClearWebSearch={() => setWebSearchArmed(false)}
          mcqArmed={mcqArmed}
          onClearMcq={() => setMcqArmed(false)}
          thinkingArmed={thinkingArmed}
          onClearThinking={() => setThinkingArmed(false)}
          listening={listening}
          error={error}
          listenError={listenError}
        />

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
            thinkingArmed={thinkingArmed}
            onThinkingToggle={() => setThinkingArmed((prev) => !prev)}
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
