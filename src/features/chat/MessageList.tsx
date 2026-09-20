import "./MessageList.css";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ModelOption } from "./message/types";
import { useMessageEdit } from "./message/useMessageEdit";
import { UserMessage } from "./message/UserMessage";
import { AssistantMessage } from "./message/AssistantMessage";

export type { ChatMessage, ModelOption } from "./message/types";

type MessageListProps = {
  messages: ChatMessage[];
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  onFollowup?: (text: string) => void;
  activeStreamId?: string | null;
  contentOverrides?: Record<string, string>;
  hasCanvasCode?: Record<string, boolean>;
  onScrollDirection?: (direction: "up" | "down") => void;
};

const MessageList = ({
  messages,
  onEditSubmit,
  editDisabled,
  modelOptions = [],
  onRegenerate,
  onStopStreaming,
  onFollowup,
  activeStreamId,
  contentOverrides,
  hasCanvasCode,
  onScrollDirection
}: MessageListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const lastScrollTop = useRef(0);
  const onScrollDirectionRef = useRef(onScrollDirection);
  onScrollDirectionRef.current = onScrollDirection;
  const edit = useMessageEdit(onEditSubmit);

  // Set when the user deliberately scrolls away from the live edge: auto-follow
  // must yield until they return to the bottom (or tap jump-to-bottom).
  const userInterrupted = useRef(false);

  const jumpToBottom = (instant = false) => {
    userInterrupted.current = false;
    scrollToBottom(instant);
  };

  const scrollToBottom = (instant = false) => {
    const el = listRef.current;
    if (!el) return;
    if (instant) {
      // Direct assignment: no animation to queue, stays glued to new tokens.
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Follow live tokens only while the user is still riding the bottom edge.
    // Any deliberate scroll-up locks follow until they return or jump down.
    if (atBottom && !userInterrupted.current) {
      // While the AI streams, tokens land in bursts — pin instantly so no
      // smooth-scroll animations pile up and judder. Animate only discrete
      // jumps (new turn when idle, jump buttons).
      scrollToBottom(activeStreamId != null);
    }
  }, [messages, atBottom, activeStreamId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance >= 120) {
        userInterrupted.current = true;
      } else if (distance < 40) {
        userInterrupted.current = false;
      }
      setAtBottom(distance < 120);
      setAtTop(el.scrollTop < 100);
      setCanScroll(el.scrollHeight > el.clientHeight + 10);
      // Smart header: report scroll direction with a small dead-zone to
      // ignore jitter; always report "up" near the top so the pill returns.
      const prev = lastScrollTop.current;
      const curr = el.scrollTop;
      lastScrollTop.current = curr;
      const cb = onScrollDirectionRef.current;
      if (cb) {
        if (curr < 64) {
          cb("up");
        } else if (curr - prev > 4) {
          cb("down");
        } else if (prev - curr > 4) {
          cb("up");
        }
      }
    };
    update();
    // rAF-throttle: coalesce burst scroll events into one state update per
    // frame so rapid token-driven growth never floods React re-renders.
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 10);
  }, [messages]);

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

          if (message.role === "USER") {
            return (
              <UserMessage
                key={message.id}
                message={message}
                isEditing={edit.editingId === message.id}
                editingValue={edit.editingValue}
                setEditingValue={edit.setEditingValue}
                editingError={edit.editingError}
                savingId={edit.savingId}
                editRef={edit.editRef}
                onEditKeyDown={edit.onEditKeyDown}
                submitEdit={edit.submitEdit}
                cancelEdit={edit.cancelEdit}
                startEdit={edit.startEdit}
                onEditSubmit={onEditSubmit}
                editDisabled={editDisabled}
              />
            );
          }

          const displayContent =
            contentOverrides?.[message.id] ?? message.content;
          const isCanvasOnly =
            !!hasCanvasCode?.[message.id] &&
            displayContent.trim().length === 0;

          return (
            <AssistantMessage
              key={message.id}
              message={message}
              displayContent={displayContent}
              isCanvasOnly={isCanvasOnly}
              messages={messages}
              modelOptions={modelOptions}
              onRegenerate={onRegenerate}
              onStopStreaming={onStopStreaming}
              onFollowup={onFollowup}
              activeStreamId={activeStreamId}
              listRef={listRef}
            />
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
              onClick={() => jumpToBottom()}
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
