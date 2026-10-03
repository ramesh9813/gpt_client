import { useEffect, useRef, useState } from "react";
import { Dropdown } from "../../../components/Dropdown";
import { IconButton } from "../../../components/IconButton";
import { normalizeTuningList } from "../chatTuning";
import type { Conversation, Folder } from "./types";

// Hover tolerance for laptop/desktop fine pointers: the three-dot button and
// the pop card are separated by a small gap, so a straight `onMouseLeave`
// close fires while the pointer is still en route. We keep the menu open for
// a short delay and cancel the close while the pointer stays within an
// expanded (~80px) zone around the menu/button area. Touch devices
// (`hover: none`) bypass all of this and close immediately, as before.
const CONV_MENU_HOVER_TOLERANCE_PX = 80;
const CONV_MENU_CLOSE_DELAY_MS = 350;

function isHoverCapablePointer(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover)").matches
    );
  } catch {
    return false;
  }
}

export interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  menuOpen: string | null;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  onPin: (conversation: Conversation) => void;
  onTuning?: (conversation: Conversation) => void;
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
  onPin,
  onTuning,
  folders,
  onMove,
}: ConversationRowProps) {
  // Two-level menu: first card holds actions, second card lists all folders.
  const [moveOpen, setMoveOpen] = useState(false);
  const isOpen = menuOpen === conversation.id;
  // Todo-list tuning badge: any enabled prompt → accent, saved-but-all-off
  // → grey, none → placeholder. Legacy single-prompt rows read as one item.
  const promptList = normalizeTuningList(conversation.customPrompts, conversation.customPrompt, conversation.customPromptEnabled);
  const promptActiveCount = promptList.filter((p) => p.enabled).length;
  const promptTitle = promptActiveCount > 0
    ? `${promptActiveCount} custom prompt${promptActiveCount === 1 ? "" : "s"} active`
    : "Custom prompts saved (all off)";
  useEffect(() => {
    if (!isOpen) setMoveOpen(false);
  }, [isOpen]);

  // Delayed, proximity-tolerant close for hover pointers only.
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const moveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);

  const cancelPendingClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (moveListenerRef.current) {
      window.removeEventListener("mousemove", moveListenerRef.current);
      moveListenerRef.current = null;
    }
  };

  // Drop any pending close when the menu closes externally or unmounts.
  useEffect(() => {
    if (!isOpen) cancelPendingClose();
  }, [isOpen]);
  useEffect(() => {
    return () => cancelPendingClose();
  }, []);

  const handleMenuMouseEnter = () => {
    if (!isHoverCapablePointer()) return;
    cancelPendingClose();
  };

  const handleMenuMouseLeave = () => {
    // Touch: preserve exact tap behavior (immediate close).
    if (!isHoverCapablePointer()) {
      onCloseMenu();
      return;
    }
    cancelPendingClose();
    const onMove = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const within =
        e.clientX >= r.left - CONV_MENU_HOVER_TOLERANCE_PX &&
        e.clientX <= r.right + CONV_MENU_HOVER_TOLERANCE_PX &&
        e.clientY >= r.top - CONV_MENU_HOVER_TOLERANCE_PX &&
        e.clientY <= r.bottom + CONV_MENU_HOVER_TOLERANCE_PX;
      if (within) cancelPendingClose();
    };
    moveListenerRef.current = onMove;
    window.addEventListener("mousemove", onMove);
    closeTimerRef.current = window.setTimeout(() => {
      if (moveListenerRef.current) {
        window.removeEventListener("mousemove", moveListenerRef.current);
        moveListenerRef.current = null;
      }
      closeTimerRef.current = null;
      onCloseMenu();
    }, CONV_MENU_CLOSE_DELAY_MS);
  };
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
      {conversation.pinned ? (
        <i className="bi bi-pin-fill conv-side-pin-icon" aria-label="Pinned" title="Pinned"></i>
      ) : (
        <span className="conv-side-pin-placeholder" aria-hidden="true" />
      )}
      {promptList.length > 0 ? (
        <span
          className={`conv-tuning-dot ${promptActiveCount > 0 ? "conv-tuning-dot--active" : "conv-tuning-dot--inactive"}`}
          title={promptTitle}
          aria-label={promptActiveCount > 0 ? "Custom prompts active" : "Custom prompts off"}
        />
      ) : (
        <span className="conv-tuning-dot conv-tuning-dot--placeholder" aria-hidden="true" />
      )}
      <div
        ref={menuRef}
        className={`conv-side-conv-menu ${menuOpen === conversation.id ? "conv-side-conv-menu--open" : "conv-side-conv-menu--closed"}`}
        onMouseEnter={handleMenuMouseEnter}
        onMouseLeave={handleMenuMouseLeave}
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
                className="conv-side-dropdown-item"
                onClick={() => onPin(conversation)}
              >
                {conversation.pinned ? "Unpin" : "Pin to top"}
              </button>
              <button
                className="conv-side-dropdown-item conv-side-dropdown-item--tuning"
                onClick={() => onTuning?.(conversation)}
              >
                <span className="conv-side-dropdown-item-label">Custom Prompt</span>
                {promptList.length > 0 ? (
                  <span
                    className={`conv-tuning-dot ${promptActiveCount > 0 ? "conv-tuning-dot--active" : "conv-tuning-dot--inactive"}`}
                    title={promptTitle}
                    aria-label={promptActiveCount > 0 ? "Custom prompts active" : "Custom prompts off"}
                  />
                ) : null}
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
