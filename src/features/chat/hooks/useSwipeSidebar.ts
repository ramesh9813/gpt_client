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
};

// Horizontal swipe gesture to open/close history sidebar on touch devices (Android & mobile)
// Mobile: controls transient drawer. Desktop: show/hide persisted sidebar.
export const useSwipeSidebar = ({
  isMobile,
  drawerOpen,
  sidebarState,
  openDrawer,
  closeDrawer,
  showSidebar,
  hideSidebar,
}: SwipeSidebarOptions) => {
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        // Don't trigger if user is interacting with an input, textarea, or editable element
        if (target.closest("textarea, input, [contenteditable='true']")) {
          touchStartX = 0;
          return;
        }
        // Don't trigger if swiping inside a horizontally scrollable code block or pre element
        const scrollable = target.closest("pre, code, .overflow-x-auto");
        if (scrollable && scrollable.scrollWidth > scrollable.clientWidth) {
          touchStartX = 0;
          return;
        }
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;
      touchStartX = 0;

      // Quick gesture within 600ms
      if (deltaTime > 600) return;

      // Ensure horizontal swipe is dominant (horizontal delta > 1.3x vertical delta) and at least 45px
      if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        if (deltaX > 0) {
          // Swipe Right -> Open history (drawer on mobile, expanded on desktop)
          if (isMobile) {
            if (!drawerOpen) openDrawer();
          } else if (sidebarState !== "expanded") {
            showSidebar();
          }
        } else {
          // Swipe Left -> Hide history (close drawer on mobile, hide on desktop)
          if (isMobile) {
            if (drawerOpen) closeDrawer();
          } else if (sidebarState === "expanded") {
            hideSidebar();
          }
        }
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
  ]);
};
