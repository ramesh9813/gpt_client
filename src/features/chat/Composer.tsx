import { KeyboardEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";

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
  onModelChange,
  inputRef,
  sort = "name",
  onSortChange
}: {
  onSend: (value: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  error?: string | null;
  lastUserMessage?: string;
  model: string;
  modelOptions: ModelOption[];
  onModelChange: (value: string) => void;
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}) => {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !streaming) {
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

  return (
    <div className="relative group/composer mx-auto mb-2 md:mb-4 w-full max-w-3xl px-3 md:px-4 pb-[max(env(safe-area-inset-bottom,0px),6px)]">
      <div className="flex w-full items-end gap-2 rounded-[26px] bg-[#303030] p-1.5 sm:p-2 shadow-sm transition-all duration-200">
        <div className="relative z-50 flex-shrink-0" ref={menuRef}>
          <Button
            variant="ghost"
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 text-gray-300 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
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
            <div className="absolute bottom-full left-0 mb-2 w-64 max-w-[85vw] rounded-xl border border-white/10 bg-[#2b2b2b] p-1.5 shadow-2xl text-white z-50 animate-in fade-in zoom-in-95 duration-150">
              {!modelMenuOpen ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/10 active:bg-white/15 transition-colors"
                    onClick={() => setModelMenuOpen(true)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <i className="bi bi-cpu text-xs text-[var(--accent)]"></i>
                      <span className="truncate">Model</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="max-w-[100px] truncate text-[11px] text-[var(--accent)]">
                        {currentModelLabel}
                      </span>
                      <i className="bi bi-chevron-right text-xs"></i>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/10 active:bg-white/15 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className="bi bi-compass text-xs text-blue-400"></i>
                    <span>Deep Research</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/10 active:bg-white/15 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className="bi bi-globe text-xs text-green-400"></i>
                    <span>Web Search</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/10 active:bg-white/15 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <i className="bi bi-image text-xs text-purple-400"></i>
                    <span>Image Generation</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10 mb-1">
                    <button
                      type="button"
                      onClick={() => setModelMenuOpen(false)}
                      className="flex items-center gap-1 text-xs text-gray-300 hover:text-white p-1"
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
                          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5"
                        >
                          <span>{sort === "name" ? "Name" : sort === "cheapest" ? "Price" : "Free"}</span>
                          <i className="bi bi-chevron-down text-[10px]"></i>
                        </button>
                        {sortOpen && (
                          <div className="absolute right-0 top-full mt-1 w-24 rounded-md border border-white/10 bg-[#303030] shadow-xl z-[60]">
                            {(["name", "cheapest", "free"] as SortOption[]).map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`w-full px-3 py-1.5 text-left text-xs ${
                                  sort === s ? "text-[var(--accent)] font-medium" : "text-gray-300"
                                } hover:bg-white/10`}
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
                  <div className="max-h-60 overflow-y-auto px-1 pb-1 pt-1 scrollbar-thin">
                    {modelOptions.map((option) => {
                      const active = option.value === model;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            active
                              ? "bg-white/15 text-white font-medium"
                              : "text-gray-300 hover:bg-white/10 hover:text-white"
                          }`}
                          onClick={() => {
                            onModelChange(option.value);
                            setModelMenuOpen(false);
                            setMenuOpen(false);
                          }}
                        >
                          <span className="truncate pr-2">{option.label}</span>
                          {active && <i className="bi bi-check text-sm text-[var(--accent)]"></i>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <textarea
          ref={setTextareaRefs}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message"
          className="flex-1 w-full min-h-[26px] max-h-48 bg-transparent border-none outline-none focus:ring-0 shadow-none py-1 px-2 text-base text-white placeholder:text-gray-500 resize-none overflow-y-auto"
        />

        {streaming ? (
          <Button
            onClick={onStop}
            variant="ghost"
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 text-white hover:bg-white/10 active:scale-95 transition-transform"
            aria-label="Stop response"
            title="Stop response"
          >
            <i className="bi bi-stop-circle-fill text-2xl" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            variant="ghost"
            className={`h-9 w-9 min-h-[36px] min-w-[36px] rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 active:scale-95 transition-transform ${
              value.trim() ? "text-white hover:bg-white/10" : "text-gray-500 hover:bg-transparent"
            }`}
            aria-label="Send message"
            title="Send message"
          >
            <i className="bi bi-arrow-up-circle-fill text-2xl" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default Composer;
