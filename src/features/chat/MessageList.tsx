import "./MessageList.css";
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
        "msg-icon-btn"
      }
      title={copied ? "Copied!" : "Copy"}
      aria-label="Copy"
      type="button"
    >
      <i
        className={`bi ${
          copied ? "bi-check2" : "bi-copy"
        } ${copied ? "msg-action-icon--accent" : "msg-action-icon"}`}
      ></i>
      {showText && <span className="msg-copy-label">{copied ? "Copied!" : "Copy"}</span>}
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
        "msg-icon-btn"
      }
      title={shared ? "Shared!" : "Share response"}
      aria-label="Share response"
      type="button"
    >
      <i
        className={`bi ${
          shared ? "bi-check2" : "bi-share"
        } ${shared ? "msg-action-icon--accent" : "msg-action-icon"}`}
      ></i>
    </button>
  );
};

const MessageImages = ({ images }: { images?: string[] }) => {
  if (!images || images.length === 0) return null;
  return (
    <div className="msg-images">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Attachment ${i + 1}`}
          loading="lazy"
          className="msg-image"
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
    <div className="msg-codeblock">
      <div className="msg-codeblock-head">
        <span className="msg-codeblock-lang">{language}</span>
        <div className="msg-codeblock-actions">
          {runnable && (
            <button
              onClick={handleRun}
              className="msg-codeblock-text-btn"
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
              className="msg-codeblock-text-btn"
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
        <div className="msg-codeblock-output">
          <div className="msg-codeblock-output-head">
            <span>Output</span>
            {typeof runState.code === "number" ? (
              <span>Exit {runState.code}</span>
            ) : null}
          </div>
          <pre className="msg-codeblock-output-pre">
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
    <div className="msg-regen-wrap" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="msg-icon-btn"
        title="Regenerate response"
        aria-label="Regenerate response"
        type="button"
      >
        <i className="bi bi-arrow-repeat msg-action-icon"></i>
      </button>

      <Dropdown open={open} placement="top" align="start" className="msg-regen-dropdown">
        <div className="msg-regen-list">
          <div className="msg-regen-title">
            Regenerate with...
          </div>
          {modelOptions.map((option) => (
            <button
              key={option.value}
              className="msg-regen-option"
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
    <div className="msg-list scrollbar-thin" ref={listRef}>
      <div className="msg-list-inner">
        {messages.map((message) => {
          if (message.role === "SYSTEM") {
            return (
              <div key={message.id} className="msg-system">
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
                className={`msg-user-row ${isEditing ? "msg-user-row--editing" : ""}`}
              >
                <div className={`msg-user-col ${isEditing ? "msg-user-col--editing" : "msg-user-col--default"}`}>
                  <div className="user-message-card msg-user-card">
                    {isEditing ? (
                      <div className="msg-user-edit-wrap">
                        <MessageImages images={message.images} />
                        <Textarea
                          ref={editRef}
                          rows={2}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          className="msg-user-edit-input"
                          aria-invalid={!!editingError}
                        />
                        {editingError ? (
                          <div className="msg-user-edit-error">
                            {editingError}
                          </div>
                        ) : null}
                        <div className="msg-user-edit-actions">
                          <button
                            className="msg-user-edit-cancel"
                            onClick={cancelEdit}
                            disabled={savingId === message.id}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="msg-user-edit-save"
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
                                return <div className="msg-md-pre">{props.children}</div>;
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
                    <div className="msg-user-actions">
                      <CopyButton
                        text={message.content}
                        showText={false}
                      />
                      {onEditSubmit && !editDisabled && (
                        <button
                          className="msg-icon-btn"
                          onClick={() => startEdit(message)}
                          disabled={editDisabled}
                          title="Edit message"
                          aria-label="Edit message"
                          type="button"
                        >
                          <i className="bi bi-pencil msg-action-icon"></i>
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
              className="msg-assistant"
            >
              <div className="markdown msg-assistant-body">
                <MessageImages images={message.images} />
                {message.status === "STREAMING" && !displayContent ? (
                  <div className="msg-typing">
                    <div className="msg-typing-dot msg-typing-dot--1"></div>
                    <div className="msg-typing-dot msg-typing-dot--2"></div>
                    <div className="msg-typing-dot msg-typing-dot--3"></div>
                  </div>
                ) : isCanvasOnly ? (
                  <div className="msg-canvas-notice">
                    Code sent to Canvas
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre(props) {
                        return <div className="msg-md-pre">{props.children}</div>;
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
                <div className="msg-assistant-footer">
                  {message.model && (
                    <div className="msg-model-label">
                      {message.model.split('/').pop()}
                    </div>
                  )}
                  {message.status === "STREAMING" ? (
                    <>
                      {onStopStreaming && activeStreamId === message.id ? (
                        <button
                          className="msg-icon-btn"
                          onClick={onStopStreaming}
                          title="Stop response"
                          aria-label="Stop response"
                          type="button"
                        >
                          <i className="bi bi-stop-circle msg-action-icon"></i>
                        </button>
                      ) : null}
                      {message.content && (
                        <div className="msg-generating" title="Generating...">
                          <div className="msg-generating-dot msg-generating-dot--1"></div>
                          <div className="msg-generating-dot msg-generating-dot--2"></div>
                          <div className="msg-generating-dot msg-generating-dot--3"></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="msg-assistant-actions">
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
        <div className="msg-jump-wrap">
          {!atTop && (
            <button
              className="msg-jump-btn"
              onClick={scrollToTop}
              title="Jump to top"
              aria-label="Scroll to top"
              type="button"
            >
              <i className="bi bi-arrow-up msg-jump-icon" aria-hidden="true"></i>
            </button>
          )}
          {!atBottom && (
            <button
              className="msg-jump-btn"
              onClick={scrollToBottom}
              title="Jump to bottom"
              aria-label="Scroll to bottom"
              type="button"
            >
              <i className="bi bi-arrow-down msg-jump-icon" aria-hidden="true"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageList;
