import { useCallback, useEffect, useState } from "react";
import {
  SidebarState,
  loadSidebarState,
  saveSidebarState,
} from "./sidebarState";

const MOBILE_QUERY = "(max-width: 1023.5px)";

export interface UseSidebarResult {
  /** Persisted desktop preference: expanded | collapsed | hidden */
  sidebarState: SidebarState;
  setSidebarState: (s: SidebarState) => void;
  /** Transient mobile drawer state (never persisted) */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  isMobile: boolean;
  expand: () => void;
  collapse: () => void;
  hide: () => void;
  show: () => void;
  /** expanded <-> collapsed */
  toggleCollapse: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

/**
 * Single source of truth for history-sidebar visibility.
 *
 * - Desktop (`lg` and up): uses persisted `sidebarState`.
 * - Mobile (< `lg`): uses transient `drawerOpen` overlay; desktop
 *   preference is left untouched so it restores on resize.
 */
export const useSidebar = (): UseSidebarResult => {
  const [sidebarState, setSidebarStateInner] = useState<SidebarState>(() =>
    loadSidebarState()
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia !== "undefined") {
      return window.matchMedia(MOBILE_QUERY).matches;
    }
    if (typeof window !== "undefined") return window.innerWidth < 1024;
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Persist desktop preference only (never the transient drawer).
  useEffect(() => {
    saveSidebarState(sidebarState);
  }, [sidebarState]);

  // Keep drawer closed when moving to desktop so it never affects chat width.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const setSidebarState = useCallback((s: SidebarState) => {
    setSidebarStateInner(s);
  }, []);

  const expand = useCallback(() => setSidebarStateInner("expanded"), []);
  // Laptop behavior: minimize fully hides history so chat gets full width.
  // Collapsed rail step is skipped (kept in type for compat only).
  const collapse = useCallback(() => setSidebarStateInner("hidden"), []);
  const hide = useCallback(() => setSidebarStateInner("hidden"), []);
  const show = useCallback(() => setSidebarStateInner("expanded"), []);

  const toggleCollapse = useCallback(() => {
    setSidebarStateInner((prev) =>
      prev === "expanded" ? "hidden" : "expanded"
    );
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((p) => !p), []);

  return {
    sidebarState,
    setSidebarState,
    drawerOpen,
    setDrawerOpen,
    isMobile,
    expand,
    collapse,
    hide,
    show,
    toggleCollapse,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  };
};
