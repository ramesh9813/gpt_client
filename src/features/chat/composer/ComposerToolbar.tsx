import type { MutableRefObject } from "react";
import { Button } from "../../../components/Button";
import { ModelMenu } from "./ModelMenu";
import type { ModelOption, SortOption } from "./ModelMenu";

export interface ComposerToolbarProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
  modelMenuOpen: boolean;
  onModelMenuOpenChange: (open: boolean) => void;
  onCloseMenu: () => void;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  model: string;
  modelOptions: ModelOption[];
  modelsLoading?: boolean;
  modelsTotal?: number;
  modelsUpdatedAt?: string | null;
  modelsStale?: { offline: boolean; updatedAgo: string } | null;
  modelResetNotice?: string | null;
  onRefreshModels?: () => void;
  modelsRefreshing?: boolean;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onModelChange: (value: string) => void;
  currentModelLabel: string;
  onResearchSelect: () => void;
  onArtifactSelect: () => void;
  researchArmed?: boolean;
  artifactArmed?: boolean;
  disabled?: boolean;
  compressing?: boolean;
  hasRecents: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
  onToggleRecents: () => void;
  cameraOpen: boolean;
  onCameraToggle: () => void;
  onQuizClick: () => void;
  listening: boolean;
  speechSupported: boolean;
  onMicClick: () => void;
  canSend: boolean;
  streaming?: boolean;
  onStop?: () => void;
  onSend: () => void;
}

/**
 * Bottom action row: options menu, upload, camera, quiz, model tag,
 * mic, send/stop. Split from Composer.tsx. No logic changes.
 */
export const ComposerToolbar = (props: ComposerToolbarProps) => {
  const {
    menuOpen,
    onToggleMenu,
    modelMenuOpen,
    onModelMenuOpenChange,
    onCloseMenu,
    menuRef,
    model,
    modelOptions,
    modelsLoading,
    modelsTotal,
    modelsUpdatedAt,
    modelsStale,
    modelResetNotice,
    onRefreshModels,
    modelsRefreshing,
    sort,
    onSortChange,
    onModelChange,
    currentModelLabel,
    onResearchSelect,
    onArtifactSelect,
    researchArmed,
    artifactArmed,
    disabled,
    compressing,
    hasRecents,
    fileInputRef,
    onFiles,
    onToggleRecents,
    cameraOpen,
    onCameraToggle,
    onQuizClick,
    listening,
    speechSupported,
    onMicClick,
    canSend,
    streaming,
    onStop,
    onSend,
  } = props;
  return (
    <div className="composer-toolbar">
    <div className="composer-menu-root" ref={menuRef}>
      <Button
        variant="ghost"
        className="composer-menu-btn"
        disabled={disabled}
        aria-label="More options"
        title="More options"
        onClick={onToggleMenu}
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
          modelMenuOpen={modelMenuOpen}
          menuOpen={menuOpen}
          onModelMenuOpenChange={onModelMenuOpenChange}
          onCloseMenu={onCloseMenu}
          onResearchSelect={onResearchSelect}
          onArtifactSelect={onArtifactSelect}
          researchArmed={researchArmed}
          artifactArmed={artifactArmed}
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
        if (!hasRecents) {
          fileInputRef.current?.click();
        } else {
          onToggleRecents();
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
      onChange={(e) => onFiles(e.target.files)}
    />

    {/* Take photo button — opens the in-app camera below */}
    <Button
      variant="ghost"
      className="composer-upload-btn"
      disabled={disabled || compressing}
      aria-label={cameraOpen ? "Close camera" : "Take photo"}
      title={cameraOpen ? "Close camera" : "Take photo"}
      onClick={onCameraToggle}
      type="button"
    >
      <i className={`bi ${cameraOpen ? "bi-camera-fill" : "bi-camera"} composer-upload-icon`} aria-hidden="true" />
    </Button>

    {/* MCQ quiz button — inserts "mcq " prefix, never auto-sends */}
    <Button
      variant="ghost"
      className="composer-upload-btn"
      disabled={disabled || compressing}
      aria-label="Start quiz"
      title="Start quiz (mcq)"
      onClick={onQuizClick}
      type="button"
    >
      <i className="bi bi-patch-question composer-upload-icon" aria-hidden="true" />
    </Button>

    {/* Read-only selected-model label — change via the '+' menu instead. */}
    <span
      className="composer-model-tag"
      title={currentModelLabel}
      aria-label={`Selected model: ${currentModelLabel}`}
      aria-readonly="true"
    >
      {currentModelLabel}
    </span>

      <div className="composer-spacer" />
    {speechSupported && (
      <Button
        onClick={onMicClick}
        disabled={disabled || streaming || compressing}
        variant="ghost"
        className={`composer-mic-btn ${
          listening ? "composer-mic-btn-listening" : ""
        }`}
        aria-label={listening ? "Stop listening" : "Voice input"}
        title={listening ? "Stop listening" : "Voice input"}
        type="button"
      >
        <i className={`bi ${listening ? "bi-mic-fill" : "bi-mic"} composer-mic-icon`} aria-hidden="true" />
      </Button>
    )}
    {streaming ? (
      <Button
        onClick={() => onStop?.()}
        variant="ghost"
        className="composer-stop-btn"
        aria-label="Stop response"
        title="Stop response"
      >
        <i className="bi bi-stop-circle-fill composer-stop-icon" />
      </Button>
    ) : (
      <Button
        onClick={onSend}
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
  );
};
