import { KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Textarea } from "../../components/Textarea";
import { DownloadMenu } from "../../components/DownloadMenu";
import { Dropdown } from "../../components/Dropdown";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status?: "COMPLETE" | "STREAMING" | "ERROR";
  model?: string | null;
};

type ModelOption = { label: string; value: string };

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
    <div className="relative inline-block ml-2" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        title="Regenerate response"
      >
        <i className="bi bi-arrow-repeat"></i>
      </button>

      <Dropdown open={open} placement="top" align="start" className="w-64 z-50">
        <div className="max-h-64 overflow-y-auto px-1 py-1">
          <div className="px-3 py-2 text-xs uppercase text-[var(--muted)]">
            Regenerate with...
          </div>
          {modelOptions.map((option) => (
            <button
              key={option.value}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--sidebar)]"
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
  activeStreamId
}: {
  messages: ChatMessage[];
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  activeStreamId?: string | null;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
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
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < 120);
      setAtTop(el.scrollTop < 100);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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

  const CopyButton = ({ text, className, showText = true }: { text: string; className?: string, showText?: boolean }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button
        onClick={handleCopy}
        className={className || "flex items-center gap-2 hover:text-white transition-colors opacity-70 hover:opacity-100"}
        title="Copy"
      >
        <i className={`bi ${copied ? "bi-check text-[var(--text)]" : "bi-copy"} text-[13px]`}></i>
        {showText && (
          copied ? "Copied!" : "Copy"
        )}
      </button>
    );
  };

  return (
    <div className="relative flex-1 overflow-y-auto scrollbar-thin" ref={listRef}>
      <div className="mx-auto max-w-3xl space-y-0 px-4 py-6">
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

          if (isUser) {
            return (
              <div
                key={message.id}
                className={`flex justify-end group ${isEditing ? "w-full" : ""}`}
              >
                <div className={`flex flex-col items-end ${isEditing ? "w-full" : "max-w-[70%]"}`}>
                  <div className="w-full rounded-xl bg-[#303030] px-4 py-3 text-base text-white">
                    {isEditing ? (
                      <div className="w-full min-w-[300px]">
                        <Textarea
                          ref={editRef}
                          rows={2}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          className="min-h-[64px] w-full text-right"
                          aria-invalid={!!editingError}
                        />
                        {editingError ? (
                          <div className="mt-2 text-xs text-red-300">
                            {editingError}
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                          <button
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:text-[var(--text)]"
                            onClick={cancelEdit}
                            disabled={savingId === message.id}
                          >
                            Cancel
                          </button>
                          <button
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--text)] hover:bg-[var(--panel)]"
                            onClick={submitEdit}
                            disabled={savingId === message.id}
                          >
                            {savingId === message.id ? "Saving..." : "Save & run"}
                          </button>
                        </div>
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
                              <div className="my-0 bg-black rounded-md relative">
                                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-black text-xs text-zinc-400 rounded-t-md">
                                  <span className="font-mono">{match[1]}</span>
                                  <CopyButton text={String(children)} />
                                </div>
                                <SyntaxHighlighter
                                  {...rest}
                                  PreTag="div"
                                  children={String(children).replace(/\n$/, "")}
                                  language={match[1]}
                                  style={vscDarkPlus}
                                  codeTagProps={{
                                    style: {
                                      backgroundColor: 'transparent',
                                      padding: 0
                                    }
                                  }}
                                  customStyle={{ 
                                    margin: 0, 
                                    background: '#000', 
                                    padding: '1rem',
                                    fontSize: '14px'
                                  }}
                                />
                              </div>
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
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                      <CopyButton 
                        text={message.content} 
                        showText={false}
                        className="text-gray-400 hover:text-white transition-colors"
                      />
                      {onEditSubmit && !editDisabled && (
                        <button
                          className="text-gray-400 hover:text-white transition-colors"
                          onClick={() => startEdit(message)}
                          disabled={editDisabled}
                          title="Edit message"
                          type="button"
                        >
                          <i className="bi bi-pencil text-[13px]"></i>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (!message.content && message.status !== "STREAMING") {
            return null;
          }

          return (
            <div
              key={message.id}
              className="rounded-xl bg-[var(--assistantRow)] p-4 group"
            >
              <div className="markdown max-w-none text-base leading-relaxed w-full">
                {message.status === "STREAMING" && !message.content ? (
                  <div className="flex gap-1 py-2 items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)] animate-bounce"></div>
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
                          <div className="my-0 bg-black rounded-md relative">
                            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-black text-xs text-zinc-400 rounded-t-md">
                              <span className="font-mono">{match[1]}</span>
                              <CopyButton text={String(children)} />
                            </div>
                            <SyntaxHighlighter
                              {...rest}
                              PreTag="div"
                              children={String(children).replace(/\n$/, "")}
                              language={match[1]}
                              style={vscDarkPlus}
                              codeTagProps={{
                                style: {
                                  backgroundColor: 'transparent',
                                  padding: 0
                                }
                              }}
                              customStyle={{ 
                                margin: 0, 
                                background: '#000', 
                                padding: '1rem',
                                fontSize: '14px'
                              }}
                            />
                          </div>
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
                )}
                <div className="mt-2 flex items-center gap-3 min-h-[20px]">
                  {message.model && (
                    <div className="text-[11px] text-[var(--muted)] opacity-60 mr-1">
                      {message.model.split('/').pop()}
                    </div>
                  )}
                  {message.status === "STREAMING" ? (
                    <>
                      {onStopStreaming && activeStreamId === message.id ? (
                        <button
                          className="inline-flex items-center gap-1 text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                          onClick={onStopStreaming}
                          title="Stop response"
                          type="button"
                        >
                          <i className="bi bi-stop-circle"></i>
                        </button>
                      ) : null}
                      {message.content && (
                        <div className="flex gap-1 items-center ml-2" title="Generating...">
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce"></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRegenerate && (
                        <RegenerateMenu 
                          messageId={message.id} 
                          modelOptions={modelOptions} 
                          onRegenerate={onRegenerate} 
                        />
                      )}
                      <CopyButton 
                        text={message.content} 
                        showText={false}
                        className="inline-flex items-center gap-1 text-[13px] text-[var(--muted)] hover:text-[var(--text)]"
                      />
                      <DownloadMenu content={message.content} messages={messages} chatContainerRef={listRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="fixed bottom-24 right-10 flex flex-col gap-2 z-20">
        {!atTop && (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-md hover:bg-[var(--sidebar)] transition-all"
            onClick={scrollToTop}
            title="Jump to top"
          >
            <i className="bi bi-arrow-up"></i>
          </button>
        )}
        {!atBottom && (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-md hover:bg-[var(--sidebar)] transition-all"
            onClick={scrollToBottom}
            title="Jump to bottom"
          >
            <i className="bi bi-arrow-down"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageList;
