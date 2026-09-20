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
    <div className="conv-side-header">
      <Button
        className="conv-side-newchat-btn"
        onClick={onNewChat}
      >
        <i className="bi bi-plus-lg conv-side-newchat-icon"></i>
        <span>New chat</span>
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
          className="conv-side-close-btn"
        >
          <i className="bi bi-x-lg conv-side-close-icon" aria-hidden="true" />
        </button>
      ) : (
        <div className="conv-side-header-actions">
          <IconButton
            onClick={onCollapse}
            aria-label="Collapse conversation history"
            title="Collapse conversation history"
            aria-expanded={sidebarState === "expanded"}
            aria-controls="conversation-history"
            className="conv-side-header-icon-btn"
          >
            <i className="bi bi-layout-sidebar-inset conv-side-header-icon"></i>
          </IconButton>
          <IconButton
            onClick={onHide}
            aria-label="Hide conversation history"
            title="Hide conversation history"
            aria-controls="conversation-history"
            className="conv-side-header-icon-btn"
          >
            <i className="bi bi-x-lg conv-side-header-icon-sm"></i>
          </IconButton>
        </div>
      )}
    </div>
  );
}
