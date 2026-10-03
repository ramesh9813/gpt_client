import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "../../../components/Input";
import { Dropdown } from "../../../components/Dropdown";
import { IconButton } from "../../../components/IconButton";
import type { Conversation, Folder } from "./types";
import { normalizeTuningList } from "../chatTuning";

// Hover tolerance for laptop/desktop fine pointers (mirrors ConversationRow):
// keep the folder pop card open while the pointer is within ~80px of the
// menu/button area, plus a short ~350ms close delay cancelled on re-enter.
// Touch devices (`hover: none`) close immediately, exactly as before.
const FOLDER_MENU_HOVER_TOLERANCE_PX = 80;
const FOLDER_MENU_CLOSE_DELAY_MS = 350;

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

function FolderMenu({
  folderId,
  isOpen,
  onToggle,
  onClose,
  children,
}: {
  folderId: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
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

  useEffect(() => {
    if (!isOpen) cancelPendingClose();
  }, [isOpen]);
  useEffect(() => {
    return () => cancelPendingClose();
  }, []);

  const handleMouseEnter = () => {
    if (!isHoverCapablePointer()) return;
    cancelPendingClose();
  };

  const handleMouseLeave = () => {
    // Touch: preserve exact tap behavior (immediate close).
    if (!isHoverCapablePointer()) {
      onClose();
      return;
    }
    cancelPendingClose();
    const onMove = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const within =
        e.clientX >= r.left - FOLDER_MENU_HOVER_TOLERANCE_PX &&
        e.clientX <= r.right + FOLDER_MENU_HOVER_TOLERANCE_PX &&
        e.clientY >= r.top - FOLDER_MENU_HOVER_TOLERANCE_PX &&
        e.clientY <= r.bottom + FOLDER_MENU_HOVER_TOLERANCE_PX;
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
      onClose();
    }, FOLDER_MENU_CLOSE_DELAY_MS);
  };

  return (
    <div
      ref={menuRef}
      className={`conv-side-folder-menu ${isOpen ? "conv-side-folder-menu--open" : "conv-side-folder-menu--closed"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <IconButton
        className="conv-side-folder-menu-btn"
        onClick={() => onToggle(folderId)}
        aria-label="Folder options"
        title="Folder options"
      >
        <i className="bi bi-three-dots"></i>
      </IconButton>
      {isOpen && (
        <div className="conv-side-menu-bridge conv-side-folder-menu-bridge" aria-hidden="true" />
      )}
      <Dropdown open={isOpen} className="conv-side-folder-dropdown">
        {children}
      </Dropdown>
    </div>
  );
}

export interface FolderSectionProps {
  folders: Folder[];
  groupedConversations: Record<string, Conversation[]>;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  isCreatingFolder: boolean;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onOpenCreateFolder: () => void;
  onCancelCreateFolder: () => void;
  onSubmitCreateFolder: () => void;
  onCreateInFolder: (folderId: string) => void;
  folderMenuOpen: string | null;
  onToggleFolderMenu: (id: string) => void;
  onCloseFolderMenu: () => void;
  onDeleteFolder: (id: string) => void;
  onTuneFolder: (id: string) => void;
  renderConversation: (conversation: Conversation) => ReactNode;
}

export function FolderSection({
  folders,
  groupedConversations,
  expandedFolders,
  onToggleFolder,
  isCreatingFolder,
  newFolderName,
  onNewFolderNameChange,
  onOpenCreateFolder,
  onCancelCreateFolder,
  onSubmitCreateFolder,
  onCreateInFolder,
  folderMenuOpen,
  onToggleFolderMenu,
  onCloseFolderMenu,
  onDeleteFolder,
  onTuneFolder,
  renderConversation,
}: FolderSectionProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(() => {
    try {
      const v = window.localStorage.getItem("chatapp.sidebar.categories.open");
      return v === null ? true : v !== "false";
    } catch {
      return true;
    }
  });
  const toggleCategories = () => {
    setCategoriesOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("chatapp.sidebar.categories.open", String(next));
      } catch {}
      return next;
    });
  };
  return (
    <div className="conv-side-section">
      <div className="conv-side-section-head">
        <div className="conv-side-section-title">
          <button
            type="button"
            className="conv-side-section-toggle"
            onClick={toggleCategories}
            aria-expanded={categoriesOpen}
            title={categoriesOpen ? "Minimize categories" : "Expand categories"}
          >
            <i
              className={`bi ${categoriesOpen ? "bi-chevron-down" : "bi-chevron-right"} conv-side-section-chev`}
              aria-hidden="true"
            ></i>
            <span className="conv-side-section-label">Categories</span>
          </button>
        </div>
        <IconButton
          className="conv-side-add-folder-btn"
          onClick={onOpenCreateFolder}
          title="New Folder"
        >
          <i className="bi bi-folder-plus conv-side-add-folder-icon"></i>
        </IconButton>
      </div>

      {categoriesOpen && isCreatingFolder && (
        <div className="conv-side-newfolder-wrap">
          <Input
            autoFocus
            placeholder="Folder name..."
            className="conv-side-newfolder-input"
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitCreateFolder();
              if (e.key === "Escape") onCancelCreateFolder();
            }}
            onBlur={() => {
              if (!newFolderName.trim()) onCancelCreateFolder();
            }}
          />
        </div>
      )}

      {categoriesOpen && (
      <div className="conv-side-folder-list">
        {folders.map((folder) => {
          const chatCount = folder._count?.conversations || 0;
          const isOpen = expandedFolders.has(folder.id);
          // Folder tuning badge: any prompt on → colored background, prompts
          // saved but all off → grey background, none → plain number.
          const folderPromptList = normalizeTuningList(folder.customPrompts, folder.customPrompt, folder.customPromptEnabled);
          const hasFolderPrompt = folderPromptList.length > 0;
          const folderPromptOn = folderPromptList.some((p) => p.enabled);
          const countClassName = `conv-side-folder-count${
            folderPromptOn
              ? " conv-side-folder-count--prompt-on"
              : hasFolderPrompt
                ? " conv-side-folder-count--prompt-off"
                : ""
          }`;
          return (
          <div key={folder.id} className="conv-side-folder-group">
            <div className="conv-side-folder-row" data-expanded={isOpen ? "true" : "false"}>
              <div className="conv-side-folder-main" onClick={() => onToggleFolder(folder.id)} title={folder.name}>
                <i className={`bi bi-folder${isOpen ? "-fill" : ""} conv-side-folder-icon`}></i>
                <span className="conv-side-folder-name">{folder.name}</span>
                {chatCount > 0 && (
                  <span
                    className={countClassName}
                    title={
                      folderPromptOn
                        ? "Folder custom prompt active"
                        : hasFolderPrompt
                          ? "Folder custom prompt saved (off)"
                          : `${chatCount} chats`
                    }
                  >
                    {chatCount}
                  </span>
                )}
              </div>
              <FolderMenu
                folderId={folder.id}
                isOpen={folderMenuOpen === folder.id}
                onToggle={onToggleFolderMenu}
                onClose={onCloseFolderMenu}
              >
                  <button
                    className="conv-side-dropdown-item conv-side-dropdown-item--with-icon"
                    onClick={() => {
                      onCreateInFolder(folder.id);
                      onCloseFolderMenu();
                    }}
                  >
                    <i className="bi bi-plus-lg conv-side-dropdown-item-icon" aria-hidden="true"></i>
                    <span>New chat</span>
                  </button>
                  <button
                    className="conv-side-dropdown-item conv-side-dropdown-item--tuning"
                    onClick={() => {
                      onTuneFolder(folder.id);
                      onCloseFolderMenu();
                    }}
                  >
                    <span className="conv-side-dropdown-item-label">Custom Prompt</span>
                    {hasFolderPrompt ? (
                      <span
                        className={`conv-tuning-dot ${folderPromptOn ? "conv-tuning-dot--active" : "conv-tuning-dot--inactive"}`}
                        title={folderPromptOn ? "Custom prompt active" : "Custom prompt saved (off)"}
                        aria-label={folderPromptOn ? "Custom prompt active" : "Custom prompt off"}
                      />
                    ) : null}
                  </button>
                  <button
                    className="conv-side-dropdown-item conv-side-dropdown-item--danger"
                    onClick={() => onDeleteFolder(folder.id)}
                  >
                    Delete folder
                  </button>
              </FolderMenu>
            </div>
            {isOpen && (
              <div className="conv-side-folder-children">
                {groupedConversations[folder.id]?.map(renderConversation)}
                {(!groupedConversations[folder.id] || groupedConversations[folder.id].length === 0) && (
                  <div className="conv-side-folder-empty">No chats</div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
