import "./Composer.css";
import { KeyboardEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { compressImageFile, MAX_IMAGES_PER_MESSAGE } from "../../lib/image";

type ModelOption = { label: string; value: string };
type SortOption = "name" | "cheapest" | "free";

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
}: {
  // images?:string[] is optional → backward compat with (value: string) => void
  onSend: (value: string, images?: string[]) => void;
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
}) => {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setModelMenuOpen(false);
        setSortOpen(false);
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
    onSend(trimmed, images.length > 0 ? [...images] : undefined);
    setValue("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) adjustTextareaHeight(el);
    });
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;
    setCompressing(true);
    try {
      const room = Math.max(0, MAX_IMAGES_PER_MESSAGE - images.length);
      const slice = picked.slice(0, room);
      const compressed = await Promise.all(
        slice.map((f) => compressImageFile(f, 1280, 0.8))
      );
      setImages((prev) => [...prev, ...compressed].slice(0, MAX_IMAGES_PER_MESSAGE));
    } catch {
      // Silently ignore failed decodes; caller can retry with another file.
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
        {images.length > 0 && (
          <div className="composer-image-strip">
            {images.map((src, idx) => (
              <div key={idx} className="composer-image-item">
                <img
                  src={src}
                  alt={`Upload ${idx + 1}`}
                  loading="lazy"
                  className="composer-image-img"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label={`Remove image ${idx + 1}`}
                  title="Remove image"
                  className="composer-image-remove"
                >
                  <i className="bi bi-x composer-image-remove-icon" aria-hidden="true" />
                </button>
              </div>
            ))}
            {compressing && (
              <span className="composer-compress-label">
                <i className="bi bi-hourglass-split composer-compress-icon" aria-hidden="true" />
                Compressing…
              </span>
            )}
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
              <div className="composer-popover">
                {!modelMenuOpen ? (
                  <div className="composer-options-list">
                    <button
                      type="button"
                      className="composer-option-model-btn"
                      onClick={() => { setModelQuery(""); setModelMenuOpen(true); }}
                    >
                      <div className="composer-option-label">
                        <i className="bi bi-cpu composer-option-icon-accent"></i>
                        <span className="composer-ellipsis">Model</span>
                      </div>
                      <div className="composer-option-meta">
                        <span className="composer-option-current">
                          {currentModelLabel}
                        </span>
                        <i className="bi bi-chevron-right composer-chevron-icon"></i>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="composer-option-btn"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-compass composer-icon-blue"></i>
                      <span>Deep Research</span>
                    </button>
                    <button
                      type="button"
                      className="composer-option-btn"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-globe composer-icon-green"></i>
                      <span>Web Search</span>
                    </button>
                    <button
                      type="button"
                      className="composer-option-btn"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-image composer-icon-purple"></i>
                      <span>Image Generation</span>
                    </button>
                  </div>
                ) : (
                  <div className="composer-model-sublist">
                    <div className="composer-subheader">
                      <button
                        type="button"
                        onClick={() => { setModelQuery(""); setModelMenuOpen(false); }}
                        className="composer-back-btn"
                      >
                        <i className="bi bi-chevron-left composer-chevron-icon"></i>
                        <span>Back</span>
                      </button>
                      {onSortChange && (
                        <div className="composer-sort-root">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSortOpen(!sortOpen);
                            }}
                            className="composer-sort-btn"
                          >
                            <span>{sort === "name" ? "Name" : sort === "cheapest" ? "Price" : "Free"}</span>
                            <i className="bi bi-chevron-down composer-sort-chevron"></i>
                          </button>
                          {sortOpen && (
                            <div className="composer-sort-menu">
                              {(["name", "cheapest", "free"] as SortOption[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={`composer-sort-option ${
                                    sort === s ? "composer-sort-option-active" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSortChange(s);
                                    setSortOpen(false);
                                  }}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="composer-query-wrap">
                      <div className="composer-query-box">
                        <i className="bi bi-search composer-query-icon" aria-hidden="true"></i>
                        <Input
                          autoFocus
                          value={modelQuery}
                          onChange={(e) => setModelQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search models..."
                          aria-label="Search models"
                          className="composer-query-input"
                        />
                        {modelQuery && (
                          <button
                            type="button"
                            onClick={() => setModelQuery("")}
                            aria-label="Clear model search"
                            title="Clear"
                            className="composer-query-clear"
                          >
                            <i className="bi bi-x composer-clear-icon" aria-hidden="true"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="composer-model-listbox">
                      {modelOptions
                        .filter((option) => {
                          const q = modelQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            option.label.toLowerCase().includes(q) ||
                            option.value.toLowerCase().includes(q)
                          );
                        })
                        .map((option) => {
                        const active = option.value === model;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`composer-model-item ${
                              active
                                ? "composer-model-item-active"
                                : "composer-model-item-idle"
                            }`}
                            onClick={() => {
                              onModelChange(option.value);
                              setModelQuery("");
                              setModelMenuOpen(false);
                              setMenuOpen(false);
                            }}
                          >
                            <span className="composer-model-label">{option.label}</span>
                            {active && <i className="bi bi-check composer-model-check"></i>}
                          </button>
                        );
                        })}
                      {(() => {
                        const filtered = modelOptions.filter((option) => {
                          const q = modelQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            option.label.toLowerCase().includes(q) ||
                            option.value.toLowerCase().includes(q)
                          );
                        });
                        if (filtered.length === 0) {
                          return (
                            <div className="composer-model-empty">
                              {modelsLoading ? "Loading models…" : modelQuery.trim() ? "No models found" : "No models available"}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
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
