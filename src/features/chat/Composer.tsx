import { KeyboardEvent, MutableRefObject, useRef, useState } from "react";
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
  const [sortOpen, setSortOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="relative group/composer mx-auto mb-4 w-full max-w-3xl px-4">
      <div className="flex w-full items-end gap-2 rounded-[26px] bg-[#303030] p-2 shadow-sm transition-all duration-200">
        <div className="relative group z-50 flex-shrink-0">
          <Button
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 text-gray-300 hover:bg-white/10 hover:text-white"
            disabled={disabled}
            aria-label="More options"
            title="More options"
          >
            <i className="bi bi-plus-lg text-lg" aria-hidden="true" />
          </Button>

          {/* Level 1 Menu Wrapper */}
          <div className="absolute bottom-full left-0 w-48 pb-6 hidden group-hover:block z-50">
            <div className="rounded-lg border border-white/10 bg-[#303030] py-1 shadow-lg text-white">
              <div className="relative group/model">
                <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10">
                  <span>Model</span>
                  <i className="bi bi-chevron-right text-xs"></i>
                </button>

                {/* Level 2 Menu */}
                <div className="absolute left-full bottom-0 w-72 pl-1 hidden group-hover/model:block z-50">
                  <div className="rounded-lg border border-white/10 bg-[#303030] shadow-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                      <div className="text-xs uppercase text-gray-400">Models</div>
                      {onSortChange && (
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSortOpen(!sortOpen); }}
                            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white"
                          >
                            {sort === "name" ? "Name" : sort === "cheapest" ? "Price" : "Free"} 
                            <i className="bi bi-chevron-down"></i>
                          </button>
                          {sortOpen && (
                            <div className="absolute right-0 top-full mt-1 w-24 rounded-md border border-white/10 bg-[#303030] shadow-lg z-[60]">
                              {["name", "cheapest", "free"].map((s) => (
                                <button 
                                  key={s}
                                  className={`w-full px-3 py-2 text-left text-xs ${sort === s ? "text-[var(--accent)]" : "text-gray-300"} hover:bg-white/10`}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onSortChange(s as SortOption); 
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
                    <div className="max-h-64 overflow-y-auto px-1 pb-1 pt-1 scrollbar-thin">
                      {modelOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`w-full rounded-md px-3 py-2 text-left text-xs ${
                            option.value === model
                              ? "bg-white/10 text-white"
                              : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
                          }`}
                          onClick={() => onModelChange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10">Deep Research</button>
              <button className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10">Search</button>
              <button className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10">Image</button>
              <button className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10">So on</button>
            </div>
          </div>
        </div>

        <textarea
          ref={setTextareaRefs}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Send a message"
          className="flex-1 w-full min-h-[24px] max-h-52 bg-transparent border-none outline-none focus:ring-0 shadow-none py-1 px-2 text-base text-white placeholder:text-gray-500 resize-none overflow-hidden"
        />

        {streaming ? (
          <Button
            onClick={onStop}
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 text-white hover:bg-transparent"
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
            className={`h-8 w-8 rounded-full p-0 flex-shrink-0 mb-0.5 mr-0.5 hover:bg-transparent ${value.trim() ? "text-white" : "text-gray-500"}`}
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
