import { useEffect, useState } from "react";
import { Dropdown } from "../../../components/Dropdown";
import { IconButton } from "../../../components/IconButton";
import type { Conversation, Folder } from "./types";

export interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  menuOpen: string | null;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  folders: Folder[];
  onMove: (conversationId: string, folderId: string | null) => void;
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
  folders,
  onMove,
}: ConversationRowProps) {
  // Two-level menu: first card holds actions, second card lists all folders.
  const [moveOpen, setMoveOpen] = useState(false);
  const isOpen = menuOpen === conversation.id;
  useEffect(() => {
    if (!isOpen) setMoveOpen(false);
  }, [isOpen]);
  return (
    <div
      key={conversation.id}
      className={`conv-side-conv-item ${active ? "conv-side-conv-item--active" : "conv-side-conv-item--inactive"}`}
      data-active={active ? "true" : "false"}
    >
      <span className="conv-side-conv-edge" aria-hidden="true" />
      <button
        className="conv-side-conv-title-btn"
        onClick={() => onSelect(conversation.id)}
        title={conversation.title}
      >
        <span className="conv-side-conv-title-text">{conversation.title}</span>
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
          {!moveOpen ? (
            <>
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
              <button
                className="conv-side-dropdown-item conv-side-move-open"
                onClick={() => setMoveOpen(true)}
                aria-haspopup="true"
              >
                <span className="conv-side-move-name">Move to category</span>
                <i className="bi bi-chevron-right conv-side-move-chev" aria-hidden="true"></i>
              </button>
            </>
          ) : (
            <>
              <button
                className="conv-side-dropdown-item conv-side-move-back"
                onClick={() => setMoveOpen(false)}
              >
                <i className="bi bi-chevron-left" aria-hidden="true"></i>
                <span>Back</span>
              </button>
              <div className="conv-side-move-label" aria-hidden="true">
                Move to
              </div>
              <div className="conv-side-move-list" role="group" aria-label="Move conversation to folder">
                <button
                  className="conv-side-dropdown-item conv-side-move-item"
                  data-selected={conversation.folderId ? "false" : "true"}
                  onClick={() => onMove(conversation.id, null)}
                >
                  <i className={`bi ${conversation.folderId ? "bi-circle" : "bi-check-circle-fill"} conv-side-move-check`} aria-hidden="true"></i>
                  <span className="conv-side-move-name">Uncategorized</span>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    className="conv-side-dropdown-item conv-side-move-item"
                    data-selected={conversation.folderId === folder.id ? "true" : "false"}
                    onClick={() => onMove(conversation.id, folder.id)}
                    title={folder.name}
                  >
                    <i className={`bi ${conversation.folderId === folder.id ? "bi-check-circle-fill" : "bi-circle"} conv-side-move-check`} aria-hidden="true"></i>
                    <span className="conv-side-move-name">{folder.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Dropdown>
      </div>
    </div>
  );
}
