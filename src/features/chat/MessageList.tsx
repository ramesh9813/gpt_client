import { KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Textarea } from "../../components/Textarea";
import { DownloadMenu } from "../../components/DownloadMenu";
import { Dropdown } from "../../components/Dropdown";
import { apiFetch, ApiResponse } from "../../lib/api";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status?: "COMPLETE" | "STREAMING" | "ERROR";
  model?: string | null;
  images?: string[];
};

type ModelOption = { label: string; value: string };

const RUN_LANGS = new Set(["python", "py", "c", "cpp", "c++", "rust", "rs", "java"]);

const normalizeRunLanguage = (language: string) => {
  const lang = language.toLowerCase();
  if (lang === "py") return "python";
  if (lang === "c++") return "cpp";
  if (lang === "rs") return "rust";
  return lang;
};

const CopyButton = ({
  text,
  className,
  showText = true
}: {
  text: string;
  className?: string;
  showText?: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={
        className ||
        "inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] active:scale-95 transition-all"
      }
      title={copied ? "Copied!" : "Copy"}
      aria-label="Copy"
      type="button"
    >
      <i
        className={`bi ${
          copied ? "bi-check2 text-[var(--accent)]" : "bi-copy"
        } text-sm`}
      ></i>
      {showText && <span className="ml-1 text-xs">{copied ? "Copied!" : "Copy"}</span>}
    </button>
  );
};

const ShareButton = ({
  text,
  title = "ChatGPT Response",
  className
}: {
  text: string;
  title?: string;
  className?: string;
}) => {
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          navigator.clipboard?.writeText(text);
          setShared(true);
          setTimeout(() => setShared(false), 2000);
        }
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={
        className ||
        "inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] active:scale-95 transition-all"
      }
      title={shared ? "Shared!" : "Share response"}
      aria-label="Share response"
      type="button"
    >
      <i
        className={`bi ${
          shared ? "bi-check2 text-[var(--accent)]" : "bi-share"
        } text-sm`}
      ></i>
    </button>
  );
};

const MessageImages = ({ images }: { images?: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <div className="mb-2 flex min-w-0 flex-wrap gap-2">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Attachment ${i + 1}`}
          loading="lazy"
          className="max-h-48 w-auto max-w-full rounded-xl border border-black/10 dark:border-white/10 object-cover"
        />
      ))}
    </div>
  );
};


const CodeBlockWithRun = ({
  language,
  code
}: {
  language: string;
  code: string;
}) => {
  const normalized = normalizeRunLanguage(language);
  const runnable = RUN_LANGS.has(language.toLowerCase());
  const [runState, setRunState] = useState<{
    status: "idle" | "running" | "done" | "error";
    output?: string;
    stderr?: string;
    code?: number | null;
  }>({ status: "idle" });

  const handleRun = async () => {
    setRunState({ status: "running" });
    try {
      const response = await apiFetch<
        ApiResponse<{ stdout?: string; stderr?: string; output?: string; code?: number }>
      >("/api/runner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: normalized,
          code
        })
      });
      const output = response.data.output || response.data.stdout || "";
      const stderr = response.data.stderr || "";
      setRunState({
        status: "done",
        output: output || stderr || "No output.",
        stderr,
        code: response.data.code ?? null
      });
    } catch (err: any) {
      setRunState({
        status: "error",
        output: err?.error?.message || "Run failed.",
        stderr: err?.error?.message
      });
    }
  };

  return (
    <div className="my-0 bg-black rounded-md relative">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-black text-xs text-zinc-400 rounded-t-md">
        <span className="font-mono">{language}</span>
        <div className="flex items-center gap-3">
          {runnable && (
            <button
              onClick={handleRun}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white"
              disabled={runState.status === "running"}
              type="button"
              title="Run code"
            >
              <i
                className={`bi ${
                  runState.status === "running"
                    ? "bi-hourglass-split"
                    : "bi-play-fill"
                }`}
              ></i>
              {runState.status === "running" ? "Running..." : "Run"}
            </button>
          )}
          {runState.status !== "idle" && (
            <button
              onClick={() => setRunState({ status: "idle" })}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white"
              type="button"
              title="Clear output"
            >
              <i className="bi bi-trash"></i>
              Clear
            </button>
          )}
          <CopyButton text={code} showText={false} />
        </div>
      </div>
      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={vscDarkPlus}
        codeTagProps={{
          style: {
            backgroundColor: "transparent",
            padding: 0
          }
        }}
        customStyle={{
          margin: 0,
          background: "#000",
          padding: "1rem",
          fontSize: "14px"
        }}
      >
        {code.replace(/\n$/, "")}
      </SyntaxHighlighter>
      {runnable && runState.status !== "idle" ? (
        <div className="border-t border-white/10 bg-[#0c0c0c] px-4 py-3 text-xs text-zinc-200">
          <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Output</span>
            {typeof runState.code === "number" ? (
              <span>Exit {runState.code}</span>
            ) : null}
          </div>
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed">
            {runState.output || runState.stderr || "No output."}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

const RegenerateMenu = ({ 
  messageId, 
  modelOptions, 
  onRegenerate 
}: { 
  messageId: string; 
  modelOptions: ModelOption[]; 
  onRegenerate: (messageId: string, model: string) => void; 
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] active:scale-95 transition-all"
        title="Regenerate response"
        aria-label="Regenerate response"
        type="button"
      >
        <i className="bi bi-arrow-repeat text-sm"></i>
      </button>

      <Dropdown open={open} placement="top" align="start" className="w-64 z-50">
        <div className="max-h-64 overflow-y-auto px-1 py-1">
          <div className="px-3 py-2 text-xs uppercase font-medium tracking-wide text-[var(--muted)]">
            Regenerate with...
          </div>
          {modelOptions.map((option) => (
            <button
              key={option.value}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--sidebar)] transition-colors"
              onClick={() => {
                onRegenerate(messageId, option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Dropdown>
    </div>
  );
};

const MessageList = ({
  messages,
  onEditSubmit,
  editDisabled,
  modelOptions = [],
  onRegenerate,
  onStopStreaming,
  activeStreamId,
  contentOverrides,
  hasCanvasCode
}: {
  messages: ChatMessage[];
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  activeStreamId?: string | null;
  contentOverrides?: Record<string, string>;
  hasCanvasCode?: Record<string, boolean>;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (atBottom) {
      scrollToBottom();
    }
  }, [messages, atBottom]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < 120);
      setAtTop(el.scrollTop < 100);
      setCanScroll(el.scrollHeight > el.clientHeight + 10);
    };
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 10);
  }, [messages]);

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => editRef.current?.focus());
  }, [editingId]);

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditingValue(message.content);
    setEditingError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
    setEditingError(null);
  };

  const submitEdit = async () => {
    if (!editingId || !onEditSubmit) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingError("Message cannot be empty");
      return;
    }
    setEditingError(null);
    setSavingId(editingId);
    try {
      await onEditSubmit(editingId, trimmed);
      setEditingId(null);
      setEditingValue("");
    } catch (err: any) {
      setEditingError(err?.message || "Failed to update message");
    } finally {
      setSavingId(null);
    }
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="relative flex-1 overflow-y-auto scrollbar-thin" ref={listRef}>
      <div className="mx-auto max-w-3xl space-y-0 px-2.5 sm:px-4 py-3 sm:py-6">
        {messages.map((message) => {
          if (message.role === "SYSTEM") {
            return (
              <div key={message.id} className="text-xs text-[var(--muted)]">
                {message.content}
              </div>
            );
          }

          const isUser = message.role === "USER";
          const isEditing = editingId === message.id;
          const displayContent =
            contentOverrides?.[message.id] ?? message.content;
          const isCanvasOnly =
            !isUser &&
            !!hasCanvasCode?.[message.id] &&
            displayContent.trim().length === 0;

          if (isUser) {
            return (
              <div
                key={message.id}
                className={`flex justify-end group py-2 ${isEditing ? "w-full" : ""}`}
              >
                <div className={`flex flex-col items-end min-w-0 ${isEditing ? "w-full" : "max-w-[88%] sm:max-w-[80%] md:max-w-[70%]"}`}>
                  <div className="user-message-card w-full rounded-2xl bg-[#f4f4f4] dark:bg-[#2f2f2f] text-[#0d0d0d] dark:text-[#ececf1] border border-[#e5e7eb] dark:border-transparent px-3.5 py-2.5 sm:px-4 sm:py-3 text-[15px] sm:text-base shadow-xs min-w-0">
                    {isEditing ? (
                      <div className="w-full min-w-[260px] sm:min-w-[300px]">
                        <MessageImages images={message.images} />
                        <Textarea
                          ref={editRef}
                          rows={2}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          className="min-h-[64px] w-full text-right bg-transparent text-[var(--text)]"
                          aria-invalid={!!editingError}
                        />
                        {editingError ? (
                          <div className="mt-2 text-xs text-red-500 dark:text-red-300">
                            {editingError}
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                          <button
                            className="rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--sidebar)] transition-colors"
                            onClick={cancelEdit}
                            disabled={savingId === message.id}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-[var(--text)] hover:bg-[var(--sidebar)] transition-colors"
                            onClick={submitEdit}
                            disabled={savingId === message.id}
                            type="button"
                          >
                            {savingId === message.id ? "Saving..." : "Save & run"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <MessageImages images={message.images} />
                        {message.content.trim().length > 0 ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              pre(props) {
                                return <div className="p-0 m-0 bg-transparent">{props.children}</div>;
                              },
                              code(props) {
                                const { children, className, node, ...rest } = props;
                                const match = /language-(\w+)/.exec(className || "");
                                return match ? (
                                  <CodeBlockWithRun
                                    language={match[1]}
                                    code={String(children)}
                                  />
                                ) : (
                                  <code {...rest} className={className}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : null}
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity px-1 py-0.5 mt-0.5">
                      <CopyButton 
                        text={message.content} 
                        showText={false}
                      />
                      {onEditSubmit && !editDisabled && (
                        <button
                          className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] active:scale-95 transition-all"
                          onClick={() => startEdit(message)}
                          disabled={editDisabled}
                          title="Edit message"
                          aria-label="Edit message"
                          type="button"
                        >
                          <i className="bi bi-pencil text-sm"></i>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (!message.content && !(message.images && message.images.length > 0) && message.status !== "STREAMING") {
            return null;
          }

          return (
            <div
              key={message.id}
              className="rounded-xl bg-[var(--assistantRow)] p-3 sm:p-4 group min-w-0"
            >
              <div className="markdown max-w-none text-base leading-relaxed w-full min-w-0">
                <MessageImages images={message.images} />
                {message.status === "STREAMING" && !displayContent ? (
                  <div className="flex gap-1 py-2 items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce"></div>
                  </div>
                ) : isCanvasOnly ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
                    Code sent to Canvas
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre(props) {
                        return <div className="p-0 m-0 bg-transparent">{props.children}</div>;
                      },
                      code(props) {
                        const { children, className, node, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        return match ? (
                          <CodeBlockWithRun
                            language={match[1]}
                            code={String(children)}
                          />
                        ) : (
                          <code {...rest} className={className}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                )}
                <div className="mt-2 flex items-center gap-1.5 min-h-[24px]">
                  {message.model && (
                    <div className="text-[11px] text-[var(--muted)] opacity-60 mr-1 truncate max-w-[150px]">
                      {message.model.split('/').pop()}
                    </div>
                  )}
                  {message.status === "STREAMING" ? (
                    <>
                      {onStopStreaming && activeStreamId === message.id ? (
                        <button
                          className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel)] active:scale-95 transition-all"
                          onClick={onStopStreaming}
                          title="Stop response"
                          aria-label="Stop response"
                          type="button"
                        >
                          <i className="bi bi-stop-circle text-sm"></i>
                        </button>
                      ) : null}
                      {message.content && (
                        <div className="flex gap-1 items-center ml-1" title="Generating...">
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce"></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <CopyButton 
                        text={message.content} 
                        showText={false}
                      />
                      <ShareButton 
                        text={message.content} 
                      />
                      <DownloadMenu 
                        content={message.content} 
                        messages={messages} 
                        chatContainerRef={listRef} 
                      />
                      {onRegenerate && (
                        <RegenerateMenu 
                          messageId={message.id} 
                          modelOptions={modelOptions} 
                          onRegenerate={onRegenerate} 
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {messages.length > 0 && canScroll && (!atTop || !atBottom) && (
        <div className="fixed bottom-44 md:bottom-48 right-3 md:right-8 flex flex-col gap-2 z-20">
          {!atTop && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-md hover:bg-[var(--sidebar)] active:scale-95 transition-all"
              onClick={scrollToTop}
              title="Jump to top"
              aria-label="Scroll to top"
              type="button"
            >
              <i className="bi bi-arrow-up text-xs" aria-hidden="true"></i>
            </button>
          )}
          {!atBottom && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-md hover:bg-[var(--sidebar)] active:scale-95 transition-all"
              onClick={scrollToBottom}
              title="Jump to bottom"
              aria-label="Scroll to bottom"
              type="button"
            >
              <i className="bi bi-arrow-down text-xs" aria-hidden="true"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageList;
