import type { ReactNode } from "react";
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
  renderConversation,
}: FolderSectionProps) {
  return (
    <div className="conv-side-section">
      <div className="conv-side-section-head">
        <div className="conv-side-section-title">
          <span className="conv-side-section-label">Categories</span>
        </div>
        <IconButton
          className="conv-side-add-folder-btn"
          onClick={onOpenCreateFolder}
          title="New Folder"
        >
          <i className="bi bi-folder-plus conv-side-add-folder-icon"></i>
        </IconButton>
      </div>

      {isCreatingFolder && (
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

      <div className="conv-side-folder-list">
        {folders.map((folder) => (
          <div key={folder.id} className="conv-side-folder-group">
            <div className="conv-side-folder-row" data-expanded={expandedFolders.has(folder.id) ? "true" : "false"}>
              <div className="conv-side-folder-main" onClick={() => onToggleFolder(folder.id)} title={folder.name}>
                <i className={`bi bi-folder${expandedFolders.has(folder.id) ? "-fill" : ""} conv-side-folder-icon`}></i>
                <span className="conv-side-folder-name">{folder.name}</span>
                {(folder._count?.conversations || 0) > 0 && (
                  <span className="conv-side-folder-count">
                    {folder._count?.conversations}
                  </span>
                )}
              </div>
              <IconButton
                className="conv-side-folder-add-btn"
                onClick={() => onCreateInFolder(folder.id)}
                title="New Chat in Folder"
              >
                <i className="bi bi-plus-lg conv-side-folder-add-icon"></i>
              </IconButton>
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
                    className="conv-side-dropdown-item conv-side-dropdown-item--danger"
                    onClick={() => onDeleteFolder(folder.id)}
                  >
                    Delete folder
                  </button>
                </Dropdown>
              </div>
            </div>
            {expandedFolders.has(folder.id) && (
              <div className="conv-side-folder-children">
                {groupedConversations[folder.id]?.map(renderConversation)}
                {(!groupedConversations[folder.id] || groupedConversations[folder.id].length === 0) && (
                  <div className="conv-side-folder-empty">No chats</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
