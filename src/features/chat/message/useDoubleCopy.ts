import { useCallback, useEffect, useRef, useState } from "react";

// Best-effort clipboard write: modern async API with legacy fallback.
export const copyTextNow = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

// Clicks on controls/links must keep their native behavior — only plain
// message content triggers the instant copy.
const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  try {
    return !!target.closest(
      "button, a, input, textarea, select, [contenteditable='true'], .download-menu-dropdown, .msg-regen-dropdown"
    );
  } catch {
    return false;
  }
};

// Copy scope: the nearest text block (paragraph, list item, heading, table
// cell, quote, code block) around the tap point. A sentence that wraps
// across visual lines still lives in ONE <p>, so the whole sentence copies.
const COPY_BLOCK_SELECTOR =
  "p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, pre";

const blockTextAt = (
  target: EventTarget | null,
  point?: { x: number; y: number } | null
): string | null => {
  const pick = (el: Element | null): string | null => {
    const block =
      el instanceof HTMLElement ? el.closest(COPY_BLOCK_SELECTOR) : null;
    if (!(block instanceof HTMLElement)) return null;
    const text = (block.innerText ?? block.textContent ?? "").trim();
    return text ? text : null;
  };
  const direct = pick(target instanceof Element ? target : null);
  if (direct) return direct;
  // Tap landed between blocks (padding/container): resolve what's under it.
  if (point && typeof document !== "undefined") {
    try {
      return pick(document.elementFromPoint(point.x, point.y));
    } catch {
      return null;
    }
  }
  return null;
};

// Double fast click (desktop) / double tap (touch) on a message copies the
// clicked line/paragraph only — never the whole response. Returns a transient
// `copied` flag for feedback plus the handlers to spread onto the message
// container.
export const useDoubleCopy = (getText: () => string) => {
  const [copied, setCopied] = useState(false);
  const getTextRef = useRef(getText);
  getTextRef.current = getText;
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Double-tap tracking (touch devices never fire dblclick reliably).
  const lastTapEnd = useRef(0);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const flash = useCallback(() => {
    setCopied(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  const fire = useCallback(
    (target: EventTarget | null, point?: { x: number; y: number } | null) => {
      // Clicked block first; whole message only when no block resolves
      // (taps on padding/cards with no text block under them).
      const text = blockTextAt(target, point) ?? getTextRef.current();
      if (!text.trim()) return;
      void copyTextNow(text).then((ok) => {
        if (ok) flash();
      });
    },
    [flash]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      fire(e.target, { x: e.clientX, y: e.clientY });
    },
    [fire]
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      if (isInteractiveTarget(e.target)) {
        lastTapEnd.current = 0;
        return;
      }
      const changed = e.changedTouches[0];
      if (changed) {
        const moved = Math.hypot(
          changed.clientX - start.x,
          changed.clientY - start.y
        );
        // Finger slid (scroll / table pan) — not a tap.
        if (moved > 12) {
          lastTapEnd.current = 0;
          return;
        }
      }
      const now = Date.now();
      // Slow press (long-press select) — not a tap.
      if (now - start.t > 400) {
        lastTapEnd.current = 0;
        return;
      }
      if (now - lastTapEnd.current < 350) {
        lastTapEnd.current = 0;
        const end = e.changedTouches[0];
        fire(
          e.target,
          end ? { x: end.clientX, y: end.clientY } : null
        );
      } else {
        lastTapEnd.current = now;
      }
    },
    [fire]
  );

  return { copied, onDoubleClick, onTouchStart, onTouchEnd };
};
