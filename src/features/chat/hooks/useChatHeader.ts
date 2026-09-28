import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../../../lib/hooks";
import type { SidebarState } from "../sidebarState";

type UseChatHeaderOptions = {
  isMobile: boolean;
  sidebarState: SidebarState;
  toggleDrawer: () => void;
  hideSidebar: () => void;
  showSidebar: () => void;
  streaming?: boolean;
};

export const useChatHeader = ({
  isMobile,
  sidebarState,
  toggleDrawer,
  hideSidebar,
  showSidebar,
  streaming = false,
}: UseChatHeaderOptions) => {
  const handleHeaderToggle = () => {
    if (isMobile) {
      toggleDrawer();
    } else if (sidebarState === "expanded") {
      // Laptop: minimize completely hides history, chat expands full width.
      // Floating pill stays visible so user can expand again.
      hideSidebar();
    } else {
      showSidebar();
    }
  };

  // Smart scroll: hide the floating pill on scroll down, reveal on scroll up.
  // Disabled when the user pins the header in Settings > Appearance.
  const [headerHidden, setHeaderHidden] = useState(false);
  // While AI is generating, the pill is forcibly hidden — only a deliberate
  // scroll-up (user interrupts auto-follow to read above) brings it back.
  const streamHiddenRef = useRef(false);
  const { data: settingsData } = useSettings();
  const pinHeader = settingsData?.data?.settings?.pinHeader ?? false;
  const showTopCard = settingsData?.data?.settings?.showTopCard ?? true;
  const handleScrollDirection = useCallback((direction: "up" | "down") => {
    setHeaderHidden(direction === "down");
  }, []);

  // Entering streaming: force-hide immediately (overrides pin + smart scroll).
  // Leaving streaming: reveal again.
  useEffect(() => {
    if (streaming) {
      streamHiddenRef.current = true;
      setHeaderHidden(true);
    } else if (streamHiddenRef.current) {
      streamHiddenRef.current = false;
      setHeaderHidden(false);
    }
  }, [streaming]);

  // While streaming, only an explicit "up" (user scrolled to top / fought
  // auto-follow) may reveal the pill — "down" keeps it hidden and is ignored
  // for toggle purposes so token-driven scroll never flickers it.
  const handleScrollDirectionWithStream = useCallback(
    (direction: "up" | "down") => {
      if (streaming && streamHiddenRef.current) {
        if (direction === "up") {
          streamHiddenRef.current = false;
          setHeaderHidden(false);
        }
        return;
      }
      handleScrollDirection(direction);
    },
    [streaming, handleScrollDirection]
  );

  return {
    handleHeaderToggle,
    headerHidden,
    pinHeader,
    showTopCard,
    handleScrollDirection: handleScrollDirectionWithStream,
  };
};
