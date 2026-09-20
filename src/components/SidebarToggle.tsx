import { cn } from "../lib/utils";
import type { SidebarState } from "../features/chat/sidebarState";
import "./SidebarToggle.css";

interface SidebarToggleProps {
  sidebarState: SidebarState;
  isMobile?: boolean;
  drawerOpen?: boolean;
  onClick: () => void;
  className?: string;
}

const getDesktopMeta = (state: SidebarState) => {
  switch (state) {
    case "expanded":
      return {
        label: "Collapse conversation history",
        icon: "bi bi-layout-sidebar-inset",
        expanded: true,
      };
    case "collapsed":
      return {
        label: "Open conversation history",
        icon: "bi bi-layout-sidebar-inset-reverse",
        expanded: false,
      };
    case "hidden":
    default:
      return {
        label: "Show conversation history",
        icon: "bi bi-layout-sidebar",
        expanded: false,
      };
  }
};

/**
 * Reusable history-sidebar toggle.
 * - Desktop: label/icon derived from persisted sidebarState.
 * - Mobile: toggles the transient overlay drawer.
 * Always keyboard-accessible with aria-expanded / aria-controls,
 * tooltip via title, and a >=40px touch target.
 */
export const SidebarToggle = ({
  sidebarState,
  isMobile = false,
  drawerOpen = false,
  onClick,
  className,
}: SidebarToggleProps) => {
  const meta = isMobile
    ? drawerOpen
      ? {
          label: "Close conversation history",
          icon: "bi bi-x-lg",
          expanded: true,
        }
      : {
          label: "Open conversation history",
          icon: "bi bi-layout-sidebar",
          expanded: false,
        }
    : getDesktopMeta(sidebarState);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={meta.label}
      title={meta.label}
      aria-expanded={meta.expanded}
      aria-controls="conversation-history"
      className={cn(
        "sidebar-toggle",
        className
      )}
    >
      <i className={`${meta.icon} sidebar-toggle-icon`} aria-hidden="true" />
    </button>
  );
};

export default SidebarToggle;
