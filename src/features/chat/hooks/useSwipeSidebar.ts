import { useEffect } from "react";
import type { SidebarState } from "../sidebarState";

type SwipeSidebarOptions = {
  isMobile: boolean;
  drawerOpen: boolean;
  sidebarState: SidebarState;
  openDrawer: () => void;
  closeDrawer: () => void;
  showSidebar: () => void;
  hideSidebar: () => void;
  canOpenCanvas: boolean;
  isCanvasOpen: boolean;
  openCanvas: () => void;
  closeCanvas: () => void;
};

// Horizontal swipe gesture to open/close history sidebar on touch devices (Android & mobile)
// Mobile: controls transient drawer. Desktop: show/hide persisted sidebar.
//
// Conflict rule (code / tables): a swipe that STARTS inside horizontally
// scrollable content NEVER opens history on the first drag — it belongs to
// the card. Only a second consecutive drag, starting at the card's edge in
// the same direction, opens history.
export const useSwipeSidebar = ({
  isMobile,
  drawerOpen,
  sidebarState,
  openDrawer,
  closeDrawer,
  showSidebar,
  hideSidebar,
  canOpenCanvas,
  isCanvasOpen,
  openCanvas,
  closeCanvas,
}: SwipeSidebarOptions) => {
  useEffect(() => {
    let tracking = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    // Inner horizontally-scrollable element (code / table) under the finger.
    let innerScrollable: HTMLElement | null = null;
    let innerStartLeft = 0;
    let innerStartWidth = 0;
    let innerStartClient = 0;
    // Two-strike gate: first edge swipe arms, second opens.
    let lastEdgeSwipeAt = 0;
    let lastEdgeSwipeDir = 0; // 1 = right, -1 = left
    const EDGE_ARM_MS = 3000;
    const EDGE = 8;

    const asElement = (t: EventTarget | null): HTMLElement | null => {
      if (!t) return null;
      if (t instanceof HTMLElement) return t;
      // Text nodes etc: fall back to parent element.
      const parent = (t as unknown as { parentElement?: HTMLElement | null })
        .parentElement;
      return parent ?? null;
    };

    // Lenient on purpose: ANY element with horizontal overflow counts, even
    // if its overflow CSS isn't literally auto/scroll (computed styles can
    // lie in WebViews, SyntaxHighlighter uses inline styles, tables use
    // display:block). Swallowing is the safe direction — worst case the user
    // needs a second swipe to open history.
    const isScrollableX = (el: HTMLElement) => {
      try {
        if (el.scrollWidth > el.clientWidth + 8) return true;
      } catch {
        return false;
      }
      return false;
    };

    const findScrollableAncestor = (target: HTMLElement | null) => {
      let el: HTMLElement | null = target;
      let depth = 0;
      while (el && depth < 10) {
        if (isScrollableX(el)) return el;
        // Stop at the thread container — beyond that it's a page swipe.
        try {
          if (el.classList?.contains("msg-list") || el.tagName === "BODY")
            break;
        } catch {
          break;
        }
        el = el.parentElement;
        depth += 1;
      }
      return null;
    };

    // Swipes starting on a code-card header / table wrapper aren't directly
    // on the scrolling node, but still belong to the card. Resolve the
    // card's inner scroller so the two-strike rule still applies.
    const findCardScroller = (target: HTMLElement | null) => {
      let card: HTMLElement | null = null;
      try {
        card = target?.closest?.(
          ".msg-codeblock, .msg-md-pre, .markdown table, .markdown pre, table, pre"
        ) as HTMLElement | null;
      } catch {
        card = null;
      }
      if (!card) return null;
      if (isScrollableX(card)) return card;
      // Shallow pass over likely scrollers (avoids full subtree scan).
      let candidates: NodeListOf<Element> | null = null;
      try {
        candidates = card.querySelectorAll?.("div, pre, code, table");
      } catch {
        candidates = null;
      }
      if (candidates) {
        for (let i = 0; i < candidates.length; i += 1) {
          const c = candidates[i] as HTMLElement;
          if (isScrollableX(c)) return c;
        }
      }
      // Card exists but nothing overflows (short code / narrow table):
      // still treat the card as owned so the first drag never pops history.
      // Return the card itself as a non-scrolling owner marker.
      return card;
    };

    const closestSafe = (
      target: HTMLElement | null,
      selector: string
    ): Element | null => {
      try {
        return target?.closest?.(selector) ?? null;
      } catch {
        return null;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        innerScrollable = null;
        return;
      }
      tracking = true;
      innerScrollable = null;
      const target = asElement(e.target);
      if (target) {
        // Don't trigger if user is interacting with an input, textarea, or editable element
        if (closestSafe(target, "textarea, input, [contenteditable='true']")) {
          tracking = false;
          return;
        }
        // Never trigger from the bottom cards (composer input, recents
        // photo rows, camera view): horizontal swipes there scroll photos
        // or viewfinder content — they must not open the history sidebar.
        if (
          closestSafe(
            target,
            ".composer-dock, .composer-recents, .composer-camera-view"
          )
        ) {
          tracking = false;
          return;
        }
        // Remember the inner scroller + where it started. touchend decides:
        // card moved => card owned it; at edge first time => arm; second
        // consecutive edge swipe in same direction => history.
        const scroller =
          findScrollableAncestor(target) ?? findCardScroller(target);
        if (scroller) {
          innerScrollable = scroller;
          try {
            innerStartLeft = scroller.scrollLeft;
            innerStartWidth = scroller.scrollWidth;
            innerStartClient = scroller.clientWidth;
          } catch {
            innerStartLeft = 0;
            innerStartWidth = 0;
            innerStartClient = 0;
          }
        }
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) {
        innerScrollable = null;
        return;
      }
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) {
        innerScrollable = null;
        return;
      }
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;

      // Fallback: touchstart may have missed the card (e.g. target was a
      // text node during layout). Re-resolve from the end target — if the
      // finger is over sideways content, swallow regardless.
      if (!innerScrollable) {
        const endTarget = asElement(e.target);
        if (endTarget) {
          const retry =
            findScrollableAncestor(endTarget) ??
            findCardScroller(endTarget);
          if (retry) innerScrollable = retry;
        }
      }

      // Slow pans (>600ms) are content scrolls, never sidebar gestures.
      if (deltaTime > 600) {
        innerScrollable = null;
        return;
      }

      // Ensure horizontal swipe is dominant (horizontal delta > 1.3x vertical delta) and at least 45px
      if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        const dir = deltaX > 0 ? 1 : -1;

        if (innerScrollable) {
          // 1) If the card actually scrolled under the finger during this
          // gesture, it owned the swipe — swallow unconditionally. This is
          // the strongest signal and covers all detection edge cases.
          let curLeft = innerStartLeft;
          try {
            if (innerScrollable.isConnected)
              curLeft = innerScrollable.scrollLeft;
          } catch {
            curLeft = innerStartLeft;
          }
          if (Math.abs(curLeft - innerStartLeft) > 4) {
            lastEdgeSwipeAt = 0;
            lastEdgeSwipeDir = 0;
            innerScrollable = null;
            return;
          }

          // 2) Card didn't move: are we at the edge for this direction?
          // Non-edge => card still owns it (user is mid-table). Swallow.
          const scrollable =
            innerStartWidth > innerStartClient + 8;
          const atEdge = !scrollable
            ? true // short code / narrow table: nothing to scroll
            : dir > 0
              ? innerStartLeft <= EDGE
              : innerStartLeft + innerStartClient >= innerStartWidth - EDGE;
          if (!atEdge) {
            lastEdgeSwipeAt = 0;
            lastEdgeSwipeDir = 0;
            innerScrollable = null;
            return;
          }

          // 3) At edge: first drag arms + swallows, second opens.
          const now = Date.now();
          const armed =
            lastEdgeSwipeDir === dir && now - lastEdgeSwipeAt < EDGE_ARM_MS;
          lastEdgeSwipeAt = now;
          lastEdgeSwipeDir = dir;
          innerScrollable = null;
          if (!armed) return;
          // Armed (second drag) — fall through to open/close below.
        } else {
          innerScrollable = null;
        }

        if (dir > 0) {
          // Swipe Right -> Close canvas first (mirror of canvas open),
          // otherwise open history (drawer on mobile, expanded on desktop)
          if (isCanvasOpen) {
            closeCanvas();
          } else if (isMobile) {
            if (!drawerOpen) openDrawer();
          } else if (sidebarState !== "expanded") {
            showSidebar();
          }
        } else {
          // Swipe Left -> Hide history first (close drawer on mobile, hide on desktop),
          // otherwise open canvas (mirror of canvas close)
          const historyOpen = isMobile
            ? drawerOpen
            : sidebarState === "expanded";
          if (historyOpen) {
            if (isMobile) closeDrawer();
            else hideSidebar();
          } else if (canOpenCanvas && !isCanvasOpen) {
            openCanvas();
          }
        }
      } else {
        innerScrollable = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isMobile,
    drawerOpen,
    sidebarState,
    openDrawer,
    closeDrawer,
    showSidebar,
    hideSidebar,
    canOpenCanvas,
    isCanvasOpen,
    openCanvas,
    closeCanvas,
  ]);
};
