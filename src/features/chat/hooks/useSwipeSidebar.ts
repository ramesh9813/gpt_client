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

    // ---- interactive follow-drag (mobile drawer tracks the finger) ----
    // The drawer opens/closes live as the finger moves: half drag => half
    // open. Engages only for plain-area drags (never inside code/tables,
    // composer, or inputs) so card scrolls are never hijacked.
    let followMode: "open" | "close" | null = null;
    let followWidth = 0;
    let moveSamples: Array<{ x: number; t: number }> = [];
    const SNAP_PROGRESS = 0.4;
    const SNAP_DX = 110;
    const FLING_PX_PER_MS = 0.45;

    const getAside = (): HTMLElement | null => {
      try {
        return document.getElementById("conversation-history");
      } catch {
        return null;
      }
    };

    const getBackdrop = (): HTMLElement | null => {
      try {
        return document.querySelector(".conv-side-backdrop") as HTMLElement | null;
      } catch {
        return null;
      }
    };

    const reducedMotion = (): boolean => {
      try {
        return (
          typeof window !== "undefined" &&
          typeof window.matchMedia !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
      } catch {
        return false;
      }
    };

    const clearFollowStyles = () => {
      const aside = getAside();
      if (aside) {
        aside.style.transition = "";
        aside.style.transform = "";
      }
      const backdrop = getBackdrop();
      if (backdrop) {
        backdrop.style.transition = "";
        backdrop.style.opacity = "";
      }
    };

    // Snap the drawer fully open with a short settle animation from the
    // dragged position.
    const snapOpenDrawer = () => {
      const aside = getAside();
      openDrawer();
      // Let React commit the open class first, then release the inline
      // transform so the CSS transition settles the remaining distance.
      window.setTimeout(() => {
        const el = getAside();
        if (el) {
          el.style.transition = "";
          el.style.transform = "";
        }
        const bd = getBackdrop();
        if (bd) {
          bd.style.transition = "";
          bd.style.opacity = "";
        }
      }, 60);
      if (aside) {
        // keep current inline position until the timeout above releases it
      }
    };

    // Snap back shut (release below threshold while opening).
    const snapShut = () => {
      closeDrawer();
      clearFollowStyles();
    };

    // Snap a close-drag shut (drawer was open, released past threshold).
    const snapCloseFinish = () => {
      const aside = getAside();
      const backdrop = getBackdrop();
      closeDrawer();
      window.setTimeout(() => {
        const el = getAside();
        if (el) {
          el.style.transition = "";
          el.style.transform = "";
        }
        const bd = getBackdrop();
        if (bd) {
          bd.style.transition = "";
          bd.style.opacity = "";
        }
      }, 60);
      if (aside || backdrop) {
        // positions held until the timeout releases them
      }
    };

    // Release a close-drag below threshold — glide back to fully open.
    const snapStayOpen = () => {
      clearFollowStyles();
    };

    const flingVelocity = (endX: number, endT: number): number => {
      // Velocity over the trailing ~120ms of the gesture.
      const cutoff = endT - 120;
      let ref = moveSamples[0];
      for (let i = moveSamples.length - 1; i >= 0; i -= 1) {
        if (moveSamples[i].t < cutoff) {
          ref = moveSamples[i];
          break;
        }
        if (i === 0) ref = moveSamples[i];
      }
      if (!ref) return 0;
      const dt = Math.max(endT - ref.t, 1);
      return (endX - ref.x) / dt;
    };

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
        if (followMode) clearFollowStyles();
        tracking = false;
        innerScrollable = null;
        followMode = null;
        moveSamples = [];
        return;
      }
      tracking = true;
      innerScrollable = null;
      followMode = null;
      moveSamples = [];
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

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      // Interactive follow is a mobile-drawer interaction only; desktop
      // keeps the threshold open/close.
      if (!isMobile || reducedMotion()) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      moveSamples.push({ x: t.clientX, t: Date.now() });
      if (moveSamples.length > 12) moveSamples.shift();

      if (!followMode) {
        // Engage only once the drag is clearly horizontal and rightward
        // for opening (drawer shut) or leftward for closing (drawer open).
        // Card/composer/input origins never engage — those gestures belong
        // to the card, handled by the two-strike rule on touchend.
        if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
        if (!drawerOpen && dx > 0 && !innerScrollable) {
          const aside = getAside();
          if (!aside) return;
          try {
            followWidth = aside.getBoundingClientRect().width || 288;
          } catch {
            followWidth = 288;
          }
          followMode = "open";
          aside.style.transition = "none";
        } else if (drawerOpen && dx < 0) {
          const aside = getAside();
          if (!aside) return;
          try {
            followWidth = aside.getBoundingClientRect().width || 288;
          } catch {
            followWidth = 288;
          }
          followMode = "close";
          aside.style.transition = "none";
          const backdrop = getBackdrop();
          if (backdrop) backdrop.style.transition = "none";
        } else {
          return;
        }
      }

      const aside = getAside();
      if (!aside) return;
      if (followMode === "open") {
        if (dx <= 0) {
          aside.style.transform = "";
          return;
        }
        const visible = Math.min(dx, followWidth);
        aside.style.transform = `translateX(${-followWidth + visible}px)`;
      } else if (followMode === "close") {
        if (dx >= 0) {
          aside.style.transform = "";
          const backdrop = getBackdrop();
          if (backdrop) backdrop.style.opacity = "";
          return;
        }
        const pulled = Math.min(-dx, followWidth);
        aside.style.transform = `translateX(${-pulled}px)`;
        const backdrop = getBackdrop();
        if (backdrop) {
          backdrop.style.opacity = `${Math.max(0, 1 - pulled / followWidth)}`;
        }
      }
    };

    const handleTouchCancel = () => {
      if (followMode) clearFollowStyles();
      tracking = false;
      innerScrollable = null;
      followMode = null;
      moveSamples = [];
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) {
        innerScrollable = null;
        followMode = null;
        return;
      }
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) {
        innerScrollable = null;
        followMode = null;
        return;
      }
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;

      // Interactive release: the drawer already tracked the finger — snap
      // open/shut from the live position instead of the threshold rule.
      if (followMode === "open") {
        followMode = null;
        const progress =
          followWidth > 0 ? Math.min(Math.max(deltaX, 0), followWidth) / followWidth : 0;
        const velocity = flingVelocity(touch.clientX, Date.now());
        innerScrollable = null;
        moveSamples = [];
        if (progress >= SNAP_PROGRESS || deltaX >= SNAP_DX || velocity >= FLING_PX_PER_MS) {
          snapOpenDrawer();
        } else {
          snapShut();
        }
        return;
      }
      if (followMode === "close") {
        followMode = null;
        const progress =
          followWidth > 0 ? Math.min(Math.max(-deltaX, 0), followWidth) / followWidth : 0;
        const velocity = -flingVelocity(touch.clientX, Date.now());
        innerScrollable = null;
        moveSamples = [];
        if (progress >= SNAP_PROGRESS || -deltaX >= SNAP_DX || velocity >= FLING_PX_PER_MS) {
          snapCloseFinish();
        } else {
          snapStayOpen();
        }
        return;
      }
      followMode = null;

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
        // Origin of this swipe: inside sideways content (code/table) or not.
        // Canvas must NEVER auto-open from a card swipe — table/code scrolls
        // stay in the card no matter how many strikes. Canvas opens only via
        // the header button or a left-drag starting on plain chat area.
        const fromCard = !!innerScrollable;

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
          // otherwise open canvas (mirror of canvas close) — but ONLY when
          // the swipe started outside code/tables. Card swipes never open
          // canvas (they are table/code scrolls); use the header button or
          // swipe from plain message area instead.
          const historyOpen = isMobile
            ? drawerOpen
            : sidebarState === "expanded";
          if (historyOpen) {
            if (isMobile) closeDrawer();
            else hideSidebar();
          } else if (canOpenCanvas && !isCanvasOpen) {
            if (!fromCard) {
              openCanvas();
            }
          }
        }
      } else {
        innerScrollable = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
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
