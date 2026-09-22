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
