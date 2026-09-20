export interface SidebarRailProps {
  onExpand: () => void;
  onHide: () => void;
  onNewChat: () => void;
}

export function SidebarRail({ onExpand, onHide, onNewChat }: SidebarRailProps) {
  return (
    <div className="sb-rail">
      <div className="sb-rail-top">
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open conversation history"
          title="Open conversation history"
          aria-expanded={false}
          aria-controls="conversation-history"
          className="sb-rail-btn sb-rail-btn--expand"
        >
          <i className="bi bi-layout-sidebar-inset-reverse sb-rail-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          className="sb-rail-btn sb-rail-btn--new"
        >
          <i className="bi bi-pencil-square sb-rail-icon-sm" aria-hidden="true" />
        </button>
      </div>
      <span className="sb-rail-divider" aria-hidden="true" />
      <div className="sb-rail-bottom">
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide conversation history"
          title="Hide conversation history"
          className="sb-rail-btn sb-rail-btn--hide"
        >
          <i className="bi bi-x-lg sb-rail-hide-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
