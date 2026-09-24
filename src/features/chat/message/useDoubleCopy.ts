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

// Double fast click (desktop) / double tap (touch) on a message copies its
// text immediately. Returns a transient `copied` flag for feedback plus the
// handlers to spread onto the message container.
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

  const fire = useCallback(() => {
    const text = getTextRef.current();
    if (!text.trim()) return;
    void copyTextNow(text).then((ok) => {
      if (ok) flash();
    });
  }, [flash]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      fire();
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
        fire();
      } else {
        lastTapEnd.current = now;
      }
    },
    [fire]
  );

  return { copied, onDoubleClick, onTouchStart, onTouchEnd };
};
