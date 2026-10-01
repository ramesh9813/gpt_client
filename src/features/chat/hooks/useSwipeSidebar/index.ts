import { useEffect } from "react";
import type { SidebarState } from "../../sidebarState";
import { asElement, closestSafe, findCardScroller, findScrollableAncestor } from "./scrollDetection";
import { clearFollowStyles, getAside, getBackdrop, reducedMotion, snapCloseFinish, snapOpenDrawer, snapShut, snapStayOpen } from "./drawerAnimator";

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

export const useSwipeSidebar = ({ isMobile, drawerOpen, sidebarState, openDrawer, closeDrawer, showSidebar, hideSidebar, canOpenCanvas, isCanvasOpen, openCanvas, closeCanvas }: SwipeSidebarOptions) => {
  useEffect(() => {
    let tracking = false;
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
    let innerScrollable: HTMLElement | null = null;
    let innerStartLeft = 0, innerStartWidth = 0, innerStartClient = 0;
    let lastEdgeSwipeAt = 0, lastEdgeSwipeDir = 0;
    const EDGE_ARM_MS = 3000, EDGE = 8;
    let followMode: "open" | "close" | null = null;
    let followWidth = 0;
    let moveSamples: Array<{ x: number; t: number }> = [];
    const SNAP_PROGRESS = 0.4, SNAP_DX = 110, FLING_PX_PER_MS = 0.45;

    const flingVelocity = (endX: number, endT: number): number => {
      const cutoff = endT - 120;
      let ref = moveSamples[0];
      for (let i = moveSamples.length - 1; i >= 0; i -= 1) {
        if (moveSamples[i].t < cutoff) { ref = moveSamples[i]; break; }
        if (i === 0) ref = moveSamples[i];
      }
      if (!ref) return 0;
      return (endX - ref.x) / Math.max(endT - ref.t, 1);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { if (followMode) clearFollowStyles(); tracking = false; innerScrollable = null; followMode = null; moveSamples = []; return; }
      tracking = true; innerScrollable = null; followMode = null; moveSamples = [];
      const target = asElement(e.target);
      if (target) {
        if (closestSafe(target, "textarea, input, [contenteditable='true']")) { tracking = false; return; }
        if (closestSafe(target, ".composer-dock, .composer-recents, .composer-camera-view")) { tracking = false; return; }
        const scroller = findScrollableAncestor(target) ?? findCardScroller(target);
        if (scroller) {
          innerScrollable = scroller;
          try { innerStartLeft = scroller.scrollLeft; innerStartWidth = scroller.scrollWidth; innerStartClient = scroller.clientWidth; } catch { innerStartLeft = 0; innerStartWidth = 0; innerStartClient = 0; }
        }
      }
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchStartTime = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      if (!isMobile || reducedMotion()) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
      moveSamples.push({ x: t.clientX, t: Date.now() }); if (moveSamples.length > 12) moveSamples.shift();
      if (!followMode) {
        // Tight pickup so the drawer starts following the finger at once.
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
        if (!drawerOpen && dx > 0 && !innerScrollable) {
          const aside = getAside(); if (!aside) return;
          try { followWidth = aside.getBoundingClientRect().width || 288; } catch { followWidth = 288; }
          followMode = "open"; aside.style.transition = "none";
        } else if (drawerOpen && dx < 0) {
          const aside = getAside(); if (!aside) return;
          try { followWidth = aside.getBoundingClientRect().width || 288; } catch { followWidth = 288; }
          followMode = "close"; aside.style.transition = "none"; const bd = getBackdrop(); if (bd) bd.style.transition = "none";
        } else return;
      }
      const aside = getAside(); if (!aside) return;
      if (followMode === "open") {
        if (dx <= 0) { aside.style.transform = ""; return; }
        aside.style.transform = `translateX(${-followWidth + Math.min(dx, followWidth)}px)`;
      } else if (followMode === "close") {
        if (dx >= 0) { aside.style.transform = ""; const bd = getBackdrop(); if (bd) bd.style.opacity = ""; return; }
        const pulled = Math.min(-dx, followWidth);
        aside.style.transform = `translateX(${-pulled}px)`;
        const bd = getBackdrop(); if (bd) bd.style.opacity = `${Math.max(0, 1 - pulled / followWidth)}`;
      }
    };

    const handleTouchCancel = () => { if (followMode) clearFollowStyles(); tracking = false; innerScrollable = null; followMode = null; moveSamples = []; };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) { innerScrollable = null; followMode = null; return; }
      tracking = false;
      const touch = e.changedTouches[0]; if (!touch) { innerScrollable = null; followMode = null; return; }
      const deltaX = touch.clientX - touchStartX, deltaY = touch.clientY - touchStartY, deltaTime = Date.now() - touchStartTime;

      if (followMode === "open") {
        followMode = null; const progress = followWidth > 0 ? Math.min(Math.max(deltaX, 0), followWidth) / followWidth : 0;
        const velocity = flingVelocity(touch.clientX, Date.now()); innerScrollable = null; moveSamples = [];
        if (progress >= SNAP_PROGRESS || deltaX >= SNAP_DX || velocity >= FLING_PX_PER_MS) snapOpenDrawer(openDrawer); else snapShut(closeDrawer); return;
      }
      if (followMode === "close") {
        followMode = null; const progress = followWidth > 0 ? Math.min(Math.max(-deltaX, 0), followWidth) / followWidth : 0;
        const velocity = -flingVelocity(touch.clientX, Date.now()); innerScrollable = null; moveSamples = [];
        if (progress >= SNAP_PROGRESS || -deltaX >= SNAP_DX || velocity >= FLING_PX_PER_MS) snapCloseFinish(closeDrawer); else snapStayOpen(); return;
      }
      followMode = null;

      if (!innerScrollable) {
        const endTarget = asElement(e.target);
        if (endTarget) { const retry = findScrollableAncestor(endTarget) ?? findCardScroller(endTarget); if (retry) innerScrollable = retry; }
      }
      if (deltaTime > 600) { innerScrollable = null; return; }
      if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        const dir = deltaX > 0 ? 1 : -1;
        const fromCard = !!innerScrollable;
        if (innerScrollable) {
          let curLeft = innerStartLeft;
          try { if (innerScrollable.isConnected) curLeft = innerScrollable.scrollLeft; } catch { curLeft = innerStartLeft; }
          if (Math.abs(curLeft - innerStartLeft) > 4) { lastEdgeSwipeAt = 0; lastEdgeSwipeDir = 0; innerScrollable = null; return; }
          const scrollable = innerStartWidth > innerStartClient + 8;
          const atEdge = !scrollable ? true : dir > 0 ? innerStartLeft <= EDGE : innerStartLeft + innerStartClient >= innerStartWidth - EDGE;
          if (!atEdge) { lastEdgeSwipeAt = 0; lastEdgeSwipeDir = 0; innerScrollable = null; return; }
          const now = Date.now(); const armed = lastEdgeSwipeDir === dir && now - lastEdgeSwipeAt < EDGE_ARM_MS;
          lastEdgeSwipeAt = now; lastEdgeSwipeDir = dir; innerScrollable = null;
          if (!armed) return;
        } else innerScrollable = null;

        if (dir > 0) {
          if (isCanvasOpen) closeCanvas(); else if (isMobile) { if (!drawerOpen) openDrawer(); } else if (sidebarState !== "expanded") showSidebar();
        } else {
          const historyOpen = isMobile ? drawerOpen : sidebarState === "expanded";
          if (historyOpen) { if (isMobile) closeDrawer(); else hideSidebar(); }
          else if (canOpenCanvas && !isCanvasOpen && !fromCard) openCanvas();
        }
      } else innerScrollable = null;
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
  }, [isMobile, drawerOpen, sidebarState, openDrawer, closeDrawer, showSidebar, hideSidebar, canOpenCanvas, isCanvasOpen, openCanvas, closeCanvas]);
};
