import type { Ref } from "react";
import { Button } from "../../../components/Button";
import { IconButton } from "../../../components/IconButton";
import type { SidebarState } from "../sidebarState";

export interface SidebarHeaderProps {
  onNewChat: () => void;
  isMobile: boolean;
  drawerOpen: boolean;
  sidebarState: SidebarState;
  onCollapse: () => void;
  onHide: () => void;
  onCloseDrawer: () => void;
  closeBtnRef: Ref<HTMLButtonElement>;
}

export function SidebarHeader({
  onNewChat,
  isMobile,
  drawerOpen,
  sidebarState,
  onCollapse,
  onHide,
  onCloseDrawer,
  closeBtnRef,
}: SidebarHeaderProps) {
  return (
    <div className="sb-header">
      <Button
        className="sb-newchat"
        onClick={onNewChat}
      >
        <span className="sb-newchat-icon-wrap" aria-hidden="true">
          <i className="bi bi-plus-lg sb-newchat-icon"></i>
        </span>
        <span className="sb-newchat-label">New chat</span>
      </Button>
      {isMobile ? (
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onCloseDrawer}
          aria-label="Close conversation history"
          title="Close conversation history"
          aria-expanded={drawerOpen}
          aria-controls="conversation-history"
          className="sb-icon-btn sb-icon-btn--close"
        >
          <i className="bi bi-x-lg sb-icon-btn-icon" aria-hidden="true" />
        </button>
      ) : (
        <div className="sb-header-actions">
          <IconButton
            onClick={onCollapse}
            aria-label="Collapse conversation history"
            title="Collapse conversation history"
            aria-expanded={sidebarState === "expanded"}
            aria-controls="conversation-history"
            className="sb-icon-btn"
          >
            <i className="bi bi-layout-sidebar-inset sb-icon-btn-icon" aria-hidden="true"></i>
          </IconButton>
          <IconButton
            onClick={onHide}
            aria-label="Hide conversation history"
            title="Hide conversation history"
            aria-controls="conversation-history"
            className="sb-icon-btn"
          >
            <i className="bi bi-x-lg sb-icon-btn-icon-sm" aria-hidden="true"></i>
          </IconButton>
        </div>
      )}
    </div>
  );
}
