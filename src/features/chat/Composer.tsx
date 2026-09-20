import "./Composer.css";
import { KeyboardEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ImageAttachments } from "./composer/ImageAttachments";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const { images, compressing, fileInputRef, handleFiles, removeImage, clearImages } =
    useComposerImages();

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

  // Beside the image icon show the model name; long names collapse to first word.
  const shortModelLabel = (() => {
    const trimmed = currentModelLabel.trim();
    return trimmed.length > 12 ? trimmed.split(/\s+/)[0] : trimmed;
  })();

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
            onClick={() => fileInputRef.current?.click()}
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

          <span
            className="composer-model-tag"
            title={currentModelLabel}
            aria-label={`Selected model: ${currentModelLabel}`}
          >
            {shortModelLabel}
          </span>

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
      {error ? (
        <div className="composer-error">{error}</div>
      ) : null}
    </div>
  );
};

export default Composer;
