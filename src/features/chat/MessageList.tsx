import "./MessageList.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../lib/api";
import type { Conversation } from "./sidebar/types";
import type { ChatMessage, ModelOption, QuizRound } from "./message/types";
import type { ArtifactBlock } from "./artifact";
import { useMessageEdit } from "./message/useMessageEdit";
import { UserMessage } from "./message/UserMessage";
import { AssistantMessage } from "./message/AssistantMessage";
import EmptyChatSuggestions from "./EmptyChatSuggestions";

export type { ChatMessage, ModelOption, QuizQuestion, QuizRound } from "./message/types";

type MessageListProps = {
  messages: ChatMessage[];
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  onFollowup?: (text: string) => void;
  onQuizSelect?: (messageId: string, quiz: QuizRound) => void;
  onNextRound?: (topic: string) => void;
  activeStreamId?: string | null;
  contentOverrides?: Record<string, string>;
  hasCanvasCode?: Record<string, boolean>;
  artifacts?: ArtifactBlock[];
  onScrollDirection?: (direction: "up" | "down") => void;
  conversationKey?: string;
};

const MessageList = ({
  messages,
  onEditSubmit,
  editDisabled,
  modelOptions = [],
  onRegenerate,
  onStopStreaming,
  onFollowup,
  onQuizSelect,
  onNextRound,
  activeStreamId,
  contentOverrides,
  hasCanvasCode,
  artifacts,
  onScrollDirection,
  conversationKey
}: MessageListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const lastScrollTop = useRef(0);
  const onScrollDirectionRef = useRef(onScrollDirection);
  onScrollDirectionRef.current = onScrollDirection;
  const edit = useMessageEdit(onEditSubmit);

  // Chat name for download filenames (<chatname>.<ext>). Subscribes to the
  // same ["conversations", ""] cache the sidebar fills, so no extra fetch.
  const { data: convList } = useQuery({
    queryKey: ["conversations", ""],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        "/api/conversations?search="
      ),
    staleTime: 1000 * 30,
  });
  const chatName = useMemo(
    () =>
      convList?.data?.items?.find((c) => c.id === conversationKey)?.title,
    [convList, conversationKey]
  );

  // Set when the user deliberately scrolls away from the live edge: auto-follow
  // must yield until they return to the bottom (or tap jump-to-bottom).
  const userInterrupted = useRef(false);
  // Latched once the user scrolls up mid-response. Unlike userInterrupted
  // (which clears when they glide back to the bottom edge), this survives
  // stream finish so a finished response never yanks them to the end.
  // Cleared on: new stream start, conversation switch, jump-to-bottom, or
  // an explicit return to the bottom edge.
  const interruptedThisTurn = useRef(false);
  const activeStreamIdRef = useRef(activeStreamId);
  activeStreamIdRef.current = activeStreamId;
  const prevStreamId = useRef<string | null>(null);
  // Suppress window: our own programmatic pins must not be mistaken for
  // user scrolls. Any deliberate scroll-UP inside the window belongs to the
  // user fighting the animation and must win immediately.
  const suppressUntil = useRef(0);
  const lastTopSync = useRef(0);

  const scrollToBottom = (instant = false) => {
    const el = listRef.current;
    if (!el) return;
    suppressUntil.current = Date.now() + (instant ? 80 : 650);
    // Anchor sync tracking at the pre-scroll position so our own smooth
    // glide (scrollTop increasing toward the bottom) never reads as a
    // user scroll-up. Only a real opposite-direction move latches.
    lastTopSync.current = el.scrollTop;
    if (instant) {
      // Direct assignment: no animation to queue, stays glued to new tokens.
      el.scrollTop = el.scrollHeight;
      lastTopSync.current = el.scrollTop;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  const jumpToBottom = (instant = false) => {
    userInterrupted.current = false;
    interruptedThisTurn.current = false;
    scrollToBottom(instant);
  };

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // New conversation: reset all scroll locks.
  useEffect(() => {
    userInterrupted.current = false;
    interruptedThisTurn.current = false;
    prevStreamId.current = null;
    lastTopSync.current = 0;
  }, [conversationKey]);

  // Stream lifecycle: start pins to the fresh turn; finish settles to the
  // end ONLY if the user never interrupted this turn.
  useEffect(() => {
    const prev = prevStreamId.current;
    const cur = activeStreamId ?? null;
    if (prev == null && cur != null) {
      interruptedThisTurn.current = false;
      userInterrupted.current = false;
      scrollToBottom(true);
    } else if (prev != null && cur == null) {
      if (!interruptedThisTurn.current && !userInterrupted.current) {
        scrollToBottom(false);
      }
    }
    prevStreamId.current = cur;
  }, [activeStreamId]);

  useEffect(() => {
    // Token follow: while streaming, pin instantly unless the user took
    // over. When idle (history load, followups, refetch), glide smoothly
    // and only when the user never interrupted the finished turn.
    if (activeStreamId != null) {
      if (!userInterrupted.current && !interruptedThisTurn.current) {
        // Tokens land in bursts — pin instantly so no smooth-scroll
        // animations pile up and judder.
        scrollToBottom(true);
      }
    } else if (atBottom && !userInterrupted.current && !interruptedThisTurn.current) {
      scrollToBottom(false);
    }
  }, [messages, atBottom, activeStreamId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    lastTopSync.current = el.scrollTop;
    let raf = 0;
    // Synchronous interrupt detection: runs BEFORE React re-renders on new
    // tokens, so a user's scroll-up always wins over a queued auto-pin.
    const detectInterrupt = () => {
      const curr = el.scrollTop;
      const prev = lastTopSync.current;
      lastTopSync.current = curr;
      const suppressed = Date.now() < suppressUntil.current;
      const movingUp = curr - prev < -4;
      const isStreaming = activeStreamIdRef.current != null;
      if (movingUp) {
        // Opposite-direction scroll during our animation: user wins, cancel
        // the programmatic glide and latch the interrupt for this turn.
        suppressUntil.current = 0;
        userInterrupted.current = true;
        if (isStreaming) interruptedThisTurn.current = true;
        return;
      }
      if (suppressed) return;
      const distance = el.scrollHeight - curr - el.clientHeight;
      if (distance >= 120) {
        userInterrupted.current = true;
        if (isStreaming) interruptedThisTurn.current = true;
      } else if (distance < 40) {
        userInterrupted.current = false;
        interruptedThisTurn.current = false;
      }
    };
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
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
    // Interrupt detection stays synchronous above so user scrolls never lose
    // the race against token-driven auto-pins.
    const onScroll = () => {
      detectInterrupt();
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
      {messages.length === 0 ? (
        <div className="msg-list-inner msg-list-inner--empty">
          <EmptyChatSuggestions
            conversationKey={conversationKey}
            onSelect={(q) => onFollowup?.(q)}
          />
        </div>
      ) : (
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
              onQuizSelect={onQuizSelect}
              onNextRound={onNextRound}
              activeStreamId={activeStreamId}
              listRef={listRef}
              artifacts={artifacts}
              chatName={chatName}
            />
          );
        })}
      </div>
      )}
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
