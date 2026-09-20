export interface SidebarRailProps {
  onExpand: () => void;
  onHide: () => void;
  onNewChat: () => void;
}

export function SidebarRail({ onExpand, onHide, onNewChat }: SidebarRailProps) {
  return (
    <div className="conv-side-collapsed-rail">
      <button
        type="button"
        onClick={onExpand}
        aria-label="Open conversation history"
        title="Open conversation history"
        aria-expanded={false}
        aria-controls="conversation-history"
        className="conv-side-rail-btn"
      >
        <i className="bi bi-layout-sidebar-inset-reverse conv-side-rail-icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onNewChat}
        aria-label="New chat"
        title="New chat"
        className="conv-side-rail-btn"
      >
        <i className="bi bi-pencil-square conv-side-rail-icon-sm" aria-hidden="true" />
      </button>
      <div className="conv-side-rail-bottom">
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide conversation history"
          title="Hide conversation history"
          className="conv-side-rail-hide-btn"
        >
          <i className="bi bi-x-lg conv-side-rail-hide-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
