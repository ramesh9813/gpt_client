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
  };

  const currentModelLabel =
    modelOptions.find((o) => o.value === model)?.label || "Model";

  // Keep hidden to satisfy TS noUnusedLocals if edit-last shortcut is wired elsewhere.
  void handleEditLast;

  return (
    <div className="composer-dock relative group/composer mx-auto mb-2 md:mb-4 w-full max-w-3xl px-3 md:px-4 pb-[max(env(safe-area-inset-bottom,0px),6px)]">
      <div className="composer-input-container flex w-full flex-col rounded-[26px] bg-[#f4f4f4] dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-[#ececf1] border border-[#e5e7eb] dark:border-[#383838] p-1.5 sm:p-2 shadow-xs transition-all duration-200 focus-within:border-[var(--muted)]/40">
        {/* Image preview strip */}
        {images.length > 0 && (
          <div className="flex w-full min-w-0 flex-wrap gap-2 px-1.5 pt-1.5 pb-1">
            {images.map((src, idx) => (
              <div key={idx} className="relative h-16 w-16 flex-shrink-0">
                <img
                  src={src}
                  alt={`Upload ${idx + 1}`}
                  loading="lazy"
                  className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label={`Remove image ${idx + 1}`}
                  title="Remove image"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 min-h-[20px] min-w-[20px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow hover:bg-[var(--sidebar)] active:scale-95 transition-all"
                >
                  <i className="bi bi-x text-xs" aria-hidden="true" />
                </button>
              </div>
            ))}
            {compressing && (
              <span className="inline-flex items-center gap-1.5 px-2 text-xs text-[var(--muted)]">
                <i className="bi bi-hourglass-split animate-pulse" aria-hidden="true" />
                Compressing…
              </span>
            )}
          </div>
        )}

        <div className="flex w-full min-w-0 flex-col gap-1">
          <textarea
            ref={setTextareaRefs}
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
            className="composer-textarea w-full min-w-0 min-h-[52px] max-h-48 bg-transparent border-none outline-none focus:ring-0 shadow-none py-1.5 px-3 text-base text-[#0d0d0d] dark:text-[#ececf1] placeholder:text-[#6b7280] dark:placeholder:text-[#a1a1aa] resize-none overflow-y-auto"
          />

          <div className="flex w-full min-w-0 items-center gap-1 px-1">
          <div className="relative z-50 flex-shrink-0" ref={menuRef}>
            <Button
              variant="ghost"
              className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)] active:scale-95 transition-all"
              disabled={disabled}
              aria-label="More options"
              title="More options"
              onClick={() => {
                setMenuOpen((prev) => !prev);
                if (menuOpen) setModelMenuOpen(false);
              }}
              type="button"
            >
              <i className={`bi ${menuOpen ? "bi-x-lg text-base" : "bi-plus-lg text-lg"}`} aria-hidden="true" />
            </Button>

            {/* Options Menu */}
            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-64 max-w-[85vw] rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-xl text-[var(--text)] z-50 animate-in fade-in zoom-in-95 duration-150">
                {!modelMenuOpen ? (
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--sidebar)] active:bg-[var(--border)] transition-colors"
                      onClick={() => { setModelQuery(""); setModelMenuOpen(true); }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <i className="bi bi-cpu text-xs text-[var(--accent)]"></i>
                        <span className="truncate">Model</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span className="max-w-[100px] truncate text-[11px] text-[var(--accent)]">
                          {currentModelLabel}
                        </span>
                        <i className="bi bi-chevron-right text-xs"></i>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--sidebar)] active:bg-[var(--border)] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-compass text-xs text-blue-500 dark:text-blue-400"></i>
                      <span>Deep Research</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--sidebar)] active:bg-[var(--border)] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-globe text-xs text-green-500 dark:text-green-400"></i>
                      <span>Web Search</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--sidebar)] active:bg-[var(--border)] transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="bi bi-image text-xs text-purple-500 dark:text-purple-400"></i>
                      <span>Image Generation</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] mb-1">
                      <button
                        type="button"
                        onClick={() => { setModelQuery(""); setModelMenuOpen(false); }}
                        className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)] p-1 transition-colors"
                      >
                        <i className="bi bi-chevron-left text-xs"></i>
                        <span>Back</span>
                      </button>
                      {onSortChange && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSortOpen(!sortOpen);
                            }}
                            className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded bg-[var(--sidebar)] border border-[var(--border)] transition-colors"
                          >
                            <span>{sort === "name" ? "Name" : sort === "cheapest" ? "Price" : "Free"}</span>
                            <i className="bi bi-chevron-down text-[10px]"></i>
                          </button>
                          {sortOpen && (
                            <div className="absolute right-0 top-full mt-1 w-24 rounded-md border border-[var(--border)] bg-[var(--panel)] shadow-xl z-[60]">
                              {(["name", "cheapest", "free"] as SortOption[]).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={`w-full px-3 py-1.5 text-left text-xs ${
                                    sort === s ? "text-[var(--accent)] font-medium" : "text-[var(--text)]"
                                  } hover:bg-[var(--sidebar)] transition-colors`}
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
                    <div className="px-1 pb-1">
                      <div className="relative">
                        <i className="bi bi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--muted)]" aria-hidden="true"></i>
                        <Input
                          autoFocus
                          value={modelQuery}
                          onChange={(e) => setModelQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search models..."
                          aria-label="Search models"
                          className="h-8 pl-8 pr-7 text-xs bg-transparent"
                        />
                        {modelQuery && (
                          <button
                            type="button"
                            onClick={() => setModelQuery("")}
                            aria-label="Clear model search"
                            title="Clear"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--sidebar)] transition-colors"
                          >
                            <i className="bi bi-x text-xs" aria-hidden="true"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto px-1 pb-1 pt-1 scrollbar-thin">
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
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                              active
                                ? "bg-[var(--sidebar)] text-[var(--text)] font-medium"
                                : "text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)]"
                            }`}
                            onClick={() => {
                              onModelChange(option.value);
                              setModelQuery("");
                              setModelMenuOpen(false);
                              setMenuOpen(false);
                            }}
                          >
                            <span className="truncate pr-2">{option.label}</span>
                            {active && <i className="bi bi-check text-sm text-[var(--accent)]"></i>}
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
                            <div className="px-2.5 py-4 text-center text-xs text-[var(--muted)]">
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
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 flex-shrink-0 text-[var(--muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text)] active:scale-95 transition-all"
            disabled={disabled || compressing}
            aria-label="Upload image"
            title="Upload image"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <i className="bi bi-image text-lg" aria-hidden="true" />
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

            <div className="min-w-0 flex-1" />
          {streaming ? (
            <Button
              onClick={onStop}
              variant="ghost"
              className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 text-[var(--text)] hover:bg-[var(--sidebar)] active:scale-95 transition-all"
              aria-label="Stop response"
              title="Stop response"
            >
              <i className="bi bi-stop-circle-fill text-2xl" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={disabled || !canSend || compressing}
              variant="ghost"
              className={`h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 active:scale-95 transition-all ${
                canSend ? "text-[var(--text)] hover:bg-[var(--sidebar)]" : "text-[var(--muted)]/40 hover:bg-transparent"
              }`}
              aria-label="Send message"
              title="Send message"
            >
              <i className="bi bi-arrow-up-circle-fill text-2xl" />
            </Button>
          )}
          </div>
        </div>
      </div>
      {error ? (
        <div className="mt-1.5 px-2 text-xs text-red-500 dark:text-red-300">{error}</div>
      ) : null}
    </div>
  );
};

export default Composer;
