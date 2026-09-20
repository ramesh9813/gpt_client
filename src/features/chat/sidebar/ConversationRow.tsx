import { Dropdown } from "../../../components/Dropdown";
import { IconButton } from "../../../components/IconButton";
import type { Conversation } from "./types";

export interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  menuOpen: string | null;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
}

export function ConversationRow({
  conversation,
  active,
  menuOpen,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onRename,
  onDelete,
}: ConversationRowProps) {
  return (
    <div
      key={conversation.id}
      className={`conv-side-conv-item ${active ? "conv-side-conv-item--active" : "conv-side-conv-item--inactive"}`}
    >
      <button
        className="conv-side-conv-title-btn"
        onClick={() => onSelect(conversation.id)}
        title={conversation.title}
      >
        {conversation.title}
      </button>
      <div
        className={`conv-side-conv-menu ${menuOpen === conversation.id ? "conv-side-conv-menu--open" : "conv-side-conv-menu--closed"}`}
        onMouseLeave={onCloseMenu}
      >
        <IconButton
          onClick={() => onToggleMenu(conversation.id)}
          aria-label="Conversation menu"
          className="conv-side-conv-menu-btn"
        >
          <i className="bi bi-three-dots"></i>
        </IconButton>
        {menuOpen === conversation.id && (
          <div className="conv-side-menu-bridge" />
        )}
        <Dropdown open={menuOpen === conversation.id} className="conv-side-conv-dropdown">
          <button
            className="conv-side-dropdown-item"
            onClick={() => onRename(conversation)}
          >
            Rename
          </button>
          <button
            className="conv-side-dropdown-item conv-side-dropdown-item--danger"
            onClick={() => onDelete(conversation.id)}
          >
            Delete
          </button>
        </Dropdown>
      </div>
    </div>
  );
}
