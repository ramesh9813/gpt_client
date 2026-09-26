// Shared scroll requests from the composer pin to the message list.
// A tiny window-event bus avoids prop-drilling the list ref through Chat.
// MessageList subscribes and drives its own useMessageFollow handlers, so
// auto-follow / interrupt behavior is untouched.

export type ListScrollEdge = "top" | "bottom";

export const LIST_SCROLL_EVENT = "chatui:scroll-list";

export const requestListScroll = (edge: ListScrollEdge): void => {
  try {
    window.dispatchEvent(
      new CustomEvent<ListScrollEdge>(LIST_SCROLL_EVENT, { detail: edge })
    );
  } catch {
    // ignore — buttons just no-op when the list is unmounted
  }
};

// Scroll-state channel in the opposite direction: MessageList publishes its
// at-bottom/at-top/direction state; the composer subscribes to drive ONE
// smart jump button (hidden while parked at the bottom of the chat).
export type ListScrollState = {
  atBottom: boolean;
  atTop: boolean;
  canScroll: boolean;
  lastDir: "up" | "down";
};

export const LIST_SCROLL_STATE_EVENT = "chatui:scroll-state";

export const publishListScrollState = (state: ListScrollState): void => {
  try {
    window.dispatchEvent(
      new CustomEvent<ListScrollState>(LIST_SCROLL_STATE_EVENT, {
        detail: state,
      })
    );
  } catch {
    // ignore
  }
};

export const subscribeListScrollState = (
  cb: (state: ListScrollState) => void
): (() => void) => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ListScrollState>).detail;
    if (detail) cb(detail);
  };
  window.addEventListener(LIST_SCROLL_STATE_EVENT, handler);
  return () => window.removeEventListener(LIST_SCROLL_STATE_EVENT, handler);
};
