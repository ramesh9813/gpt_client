import { clampWps, readStreamWps } from "../../streamSpeed";

const FRAME_MS = 16;
const CHARS_PER_WORD = 5;

export type ThrottleState = {
  pendingText: string;
  streamDone: boolean;
  rafId: number | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
  resolveFlushDone: (() => void) | null;
};

export const createThrottle = (
  state: ThrottleState,
  isCancelled: () => boolean,
  appendChunk: (chunk: string) => void
) => {
  let firstTokenFlushed = false;

  const resolveOnce = () => {
    if (!state.resolveFlushDone) return;
    const r = state.resolveFlushDone;
    state.resolveFlushDone = null;
    r();
  };

  const flushPending = () => {
    state.flushTimer = null;
    state.rafId = null;
    if (isCancelled()) { state.pendingText = ""; resolveOnce(); return; }
    if (state.pendingText.length === 0) { if (state.streamDone) resolveOnce(); return; }

    // First token paints instantly — no RAF delay — for best perceived TTFB.
    if (!firstTokenFlushed) {
      firstTokenFlushed = true;
      const first = state.pendingText.slice(0, Math.min(state.pendingText.length, 64));
      const at = first.lastIndexOf(" ") > 3 ? first.lastIndexOf(" ") + 1 : first.length;
      const chunk = state.pendingText.slice(0, at);
      state.pendingText = state.pendingText.slice(at);
      appendChunk(chunk);
      if (state.pendingText.length === 0 && state.streamDone) { resolveOnce(); return; }
      if (state.pendingText.length > 0) scheduleFlush();
      return;
    }

    const liveWps = clampWps(readStreamWps());
    const charsPerFrame = Math.max(1, Math.round((liveWps * CHARS_PER_WORD * FRAME_MS) / 1000));
    const budget = charsPerFrame;
    if (state.pendingText.length <= budget) {
      const chunk = state.pendingText; state.pendingText = ""; appendChunk(chunk);
      if (state.streamDone) resolveOnce(); else if (state.pendingText.length > 0) scheduleFlush();
      return;
    }
    const spaceCut = state.pendingText.lastIndexOf(" ", budget);
    const nlCut = state.pendingText.lastIndexOf("\n", budget);
    const at = Math.max(spaceCut, nlCut) > 3 ? Math.max(spaceCut, nlCut) + 1 : budget;
    const chunk = state.pendingText.slice(0, at);
    state.pendingText = state.pendingText.slice(at);
    appendChunk(chunk);
    scheduleFlush();
  };

  const scheduleFlush = () => {
    if (isCancelled()) return;
    if (state.rafId != null || state.flushTimer != null) return;
    if (typeof requestAnimationFrame === "function") {
      state.rafId = requestAnimationFrame(() => { state.rafId = null; flushPending(); });
    } else state.flushTimer = setTimeout(flushPending, FRAME_MS);
  };

  const startFlush = () => { if (!isCancelled()) scheduleFlush(); };

  // Sync flush for the very first token so TTFB is not gated on the next frame.
  const flushFirstTokenSync = () => {
    if (firstTokenFlushed || state.pendingText.length === 0 || isCancelled()) return;
    firstTokenFlushed = true;
    const chunk = state.pendingText.slice(0, Math.min(state.pendingText.length, 64));
    // Prefer word boundary but never withhold: flush at least 1 char.
    const at = chunk.lastIndexOf(" ") > 2 ? chunk.lastIndexOf(" ") + 1 : chunk.length;
    const take = state.pendingText.slice(0, at);
    state.pendingText = state.pendingText.slice(at);
    appendChunk(take);
  };

  return { flushPending, scheduleFlush, startFlush, flushFirstTokenSync, resolveOnce, get firstTokenFlushed() { return firstTokenFlushed; } };
};
