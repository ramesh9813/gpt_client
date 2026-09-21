import { useCallback, useState } from "react";
import { useSettings } from "../../../lib/hooks";
import type { SidebarState } from "../sidebarState";

type UseChatHeaderOptions = {
  isMobile: boolean;
  sidebarState: SidebarState;
  toggleDrawer: () => void;
  hideSidebar: () => void;
  showSidebar: () => void;
};

export const useChatHeader = ({
  isMobile,
  sidebarState,
  toggleDrawer,
  hideSidebar,
  showSidebar,
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
  const { data: settingsData } = useSettings();
  const pinHeader = settingsData?.data?.settings?.pinHeader ?? false;
  const handleScrollDirection = useCallback((direction: "up" | "down") => {
    setHeaderHidden(direction === "down");
  }, []);

  return { handleHeaderToggle, headerHidden, pinHeader, handleScrollDirection };
};
