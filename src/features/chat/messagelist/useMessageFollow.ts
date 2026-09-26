import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../message/types";

type UseMessageFollowOptions = {
  messages: ChatMessage[];
  activeStreamId?: string | null;
  conversationKey?: string;
  onScrollDirection?: (direction: "up" | "down") => void;
  onScrollState?: (state: {
    atBottom: boolean;
    atTop: boolean;
    canScroll: boolean;
    lastDir: "up" | "down";
  }) => void;
};

export const useMessageFollow = ({
  messages,
  activeStreamId,
  conversationKey,
  onScrollDirection,
  onScrollState,
}: UseMessageFollowOptions) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [canScroll, setCanScroll] = useState(false);
  const lastScrollTop = useRef(0);
  const lastScrollDir = useRef<"up" | "down">("down");
  const onScrollDirectionRef = useRef(onScrollDirection);
  onScrollDirectionRef.current = onScrollDirection;
  const onScrollStateRef = useRef(onScrollState);
  onScrollStateRef.current = onScrollState;

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
          lastScrollDir.current = "up";
        } else if (curr - prev > 4) {
          cb("down");
          lastScrollDir.current = "down";
        } else if (prev - curr > 4) {
          cb("up");
          lastScrollDir.current = "up";
        }
      }
      // Composer's single smart jump button mirrors this state.
      onScrollStateRef.current?.({
        atBottom: distance < 120,
        atTop: el.scrollTop < 100,
        canScroll: el.scrollHeight > el.clientHeight + 10,
        lastDir: lastScrollDir.current,
      });
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

  return {
    listRef,
    atBottom,
    atTop,
    canScroll,
    scrollToBottom,
    jumpToBottom,
    scrollToTop,
  };
};

export type MessageFollowApi = ReturnType<typeof useMessageFollow>;
