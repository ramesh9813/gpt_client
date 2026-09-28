import { useState, type ReactNode } from "react";
import { Input } from "../../../components/Input";
import { Dropdown } from "../../../components/Dropdown";
import { IconButton } from "../../../components/IconButton";
import type { Conversation, Folder } from "./types";

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
          // Folder tuning badge: prompt on → colored background, prompt saved
          // but off → grey background, no prompt → plain number, no background.
          const hasFolderPrompt =
            typeof folder.customPrompt === "string" && folder.customPrompt.trim().length > 0;
          const folderPromptOn = hasFolderPrompt && folder.customPromptEnabled !== false;
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
              <div className={`conv-side-folder-menu ${folderMenuOpen === folder.id ? "conv-side-folder-menu--open" : "conv-side-folder-menu--closed"}`}
                onMouseLeave={onCloseFolderMenu}>
                <IconButton
                  className="conv-side-folder-menu-btn"
                  onClick={() => onToggleFolderMenu(folder.id)}
                  aria-label="Folder options"
                  title="Folder options"
                >
                  <i className="bi bi-three-dots"></i>
                </IconButton>
                <Dropdown open={folderMenuOpen === folder.id} className="conv-side-folder-dropdown">
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
                </Dropdown>
              </div>
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
