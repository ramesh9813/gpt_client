import "./ConversationSidebar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, ApiResponse } from "../../lib/api";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Dropdown } from "../../components/Dropdown";
import { Modal } from "../../components/Modal";
import { IconButton } from "../../components/IconButton";
import { useMe } from "../../lib/hooks";
import type { SidebarState } from "./sidebarState";
import { cn } from "../../lib/utils";

export type Conversation = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { conversations: number };
};

export interface ConversationSidebarProps {
  sidebarState: SidebarState;
  drawerOpen: boolean;
  isMobile: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onHide: () => void;
  onCloseDrawer: () => void;
  onOpenDrawer?: () => void;
}

const ConversationSidebar = ({
  sidebarState,
  drawerOpen,
  isMobile,
  onExpand,
  onCollapse,
  onHide,
  onCloseDrawer,
}: ConversationSidebarProps) => {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const { data: meData } = useMe();

  const user = meData?.data?.user;
  const initial = (user?.name?.[0] || user?.email?.[0] || "?").toUpperCase();

  const hiddenCompletely = isMobile ? !drawerOpen : sidebarState === "hidden";
  useEffect(() => {
    const el = asideRef.current as unknown as { inert?: boolean } | null;
    if (el) el.inert = hiddenCompletely;
  }, [hiddenCompletely]);

  useEffect(() => {
    const el = panelRef.current as unknown as { inert?: boolean } | null;
    if (!el) return;
    el.inert = !isMobile && sidebarState === "collapsed";
  }, [isMobile, sidebarState]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, drawerOpen, onCloseDrawer]);

  useEffect(() => {
    if (isMobile && drawerOpen) {
      closeBtnRef.current?.focus();
    }
  }, [isMobile, drawerOpen]);

  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Folder[] }>>("/api/folders")
  });

  const { data } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        `/api/conversations?search=${encodeURIComponent(search)}`
      )
  });

  const createMutation = useMutation({
    mutationFn: (folderId?: string) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId })
        }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${res.data.conversation.id}`);
      if (isMobile) onCloseDrawer();
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<ApiResponse<{ folder: Folder }>>(
        "/api/folders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  });

  const renameMutation = useMutation({
    mutationFn: (payload: { id: string; title: string }) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        `/api/conversations/${payload.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: payload.title })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<{}>>(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      if (params.conversationId === menuOpen) {
        navigate("/");
      }
    }
  });

  const { folders, groupedConversations, uncategorized } = useMemo(() => {
    const fs = foldersData?.data?.items || [];
    const cs = data?.data?.items || [];
    const groups: Record<string, Conversation[]> = {};
    const uncat: Conversation[] = [];
    cs.forEach(c => {
      if (c.folderId) {
        if (!groups[c.folderId]) groups[c.folderId] = [];
        groups[c.folderId].push(c);
      } else {
        uncat.push(c);
      }
    });
    return {
      folders: fs,
      groupedConversations: groups,
      uncategorized: uncat.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    };
  }, [foldersData, data]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renameSchema = useMemo(
    () => z.string().min(1, "Title is required").max(80, "Max 80 characters"),
    []
  );

  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  const handleSelectConversation = (id: string) => {
    navigate(`/c/${id}`);
    if (isMobile) onCloseDrawer();
  };

  const renderConversation = (conversation: Conversation) => {
    const active = params.conversationId === conversation.id;
    return (
      <div
        key={conversation.id}
        className={`conv-side-conv-item ${active ? "conv-side-conv-item--active" : "conv-side-conv-item--inactive"}`}
      >
        <button
          className="conv-side-conv-title-btn"
          onClick={() => handleSelectConversation(conversation.id)}
          title={conversation.title}
        >
          {conversation.title}
        </button>
        <div
          className={`conv-side-conv-menu ${menuOpen === conversation.id ? "conv-side-conv-menu--open" : "conv-side-conv-menu--closed"}`}
          onMouseLeave={() => setMenuOpen(null)}
        >
          <IconButton
            onClick={() =>
              setMenuOpen((prev) =>
                prev === conversation.id ? null : conversation.id
              )
            }
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
              onClick={() => {
                setRenameId(conversation.id);
                setRenameTitle(conversation.title);
                setRenameError(null);
                setMenuOpen(null);
              }}
            >
              Rename
            </button>
            <button
              className="conv-side-dropdown-item conv-side-dropdown-item--danger"
              onClick={() => {
                deleteMutation.mutate(conversation.id);
                setMenuOpen(null);
              }}
            >
              Delete
            </button>
          </Dropdown>
        </div>
      </div>
    );
  };

  const showBackdrop = isMobile && drawerOpen;
  const isCollapsedDesktop = !isMobile && sidebarState === "collapsed";

  const asideClasses = cn(
    "conv-side",
    drawerOpen ? "conv-side--drawer-open" : "conv-side--drawer-closed",
    !isMobile && sidebarState === "expanded" && "conv-side--expanded",
    !isMobile && sidebarState === "collapsed" && "conv-side--collapsed",
    !isMobile && sidebarState === "hidden" && "conv-side--hidden",
    isMobile && !drawerOpen && "conv-side--mobile-closed"
  );

  return (
    <>
      {showBackdrop && (
        <div
          className="conv-side-backdrop"
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        ref={asideRef}
        id="conversation-history"
        aria-label="Conversation history"
        aria-hidden={hiddenCompletely}
        className={asideClasses}
      >
        {isCollapsedDesktop && (
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
              onClick={() => createMutation.mutate(undefined)}
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
        )}

        <div
          ref={panelRef}
          className={cn(
            "conv-side-panel",
            !isMobile && sidebarState === "collapsed" ? "conv-side-panel--hidden" : "conv-side-panel--visible"
          )}
          aria-hidden={!isMobile && sidebarState !== "expanded"}
        >
          <div className="conv-side-header">
            <Button
              className="conv-side-newchat-btn"
              onClick={() => createMutation.mutate(undefined)}
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

          <div className="conv-side-body">
            <div className="conv-side-search-wrap">
              <div className="conv-side-search-inner">
                <i className="bi bi-search conv-side-search-icon"></i>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="conv-side-search-input"
                />
              </div>
            </div>
            <div className="conv-side-scroll scrollbar-thin">
              <div className="conv-side-section">
                <div className="conv-side-section-head">
                  <div className="conv-side-section-title">
                    Categories
                  </div>
                  <IconButton
                    className="conv-side-add-folder-btn"
                    onClick={() => setIsCreatingFolder(true)}
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
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createFolderMutation.mutate(newFolderName);
                        if (e.key === "Escape") setIsCreatingFolder(false);
                      }}
                      onBlur={() => {
                        if (!newFolderName.trim()) setIsCreatingFolder(false);
                      }}
                    />
                  </div>
                )}

                <div className="conv-side-folder-list">
                  {folders.map((folder) => (
                    <div key={folder.id} className="conv-side-folder-group">
                      <div className="conv-side-folder-row">
                        <div className="conv-side-folder-main" onClick={() => toggleFolder(folder.id)}>
                          <i className={`bi bi-chevron-${expandedFolders.has(folder.id) ? "down" : "right"} conv-side-folder-chevron`}></i>
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
                          onClick={() => createMutation.mutate(folder.id)}
                          title="New Chat in Folder"
                        >
                          <i className="bi bi-plus-lg conv-side-folder-add-icon"></i>
                        </IconButton>
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

              <div className="conv-side-section">
                <div className="conv-side-history-head">
                  History
                </div>
                <div className="conv-side-history-list">
                  {uncategorized.map(renderConversation)}
                </div>
              </div>
            </div>
            <div className="conv-side-footer">
              <Link
                to="/account"
                className="conv-side-account-link"
                onClick={() => {
                  if (isMobile) onCloseDrawer();
                }}
              >
                <div className="conv-side-avatar">
                  {initial}
                </div>
                <div className="conv-side-account-info">
                  <span className="conv-side-account-name">{user?.name || "User"}</span>
                  <span className="conv-side-account-email">{user?.email}</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
        <Modal
          open={!!renameId}
          title="Rename conversation"
          onClose={() => {
            setRenameId(null);
            setRenameError(null);
          }}
        >
          <div className="conv-side-modal-body">
            <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
            {renameError ? (
              <div className="conv-side-modal-error">
                {renameError}
              </div>
            ) : null}
            <div className="conv-side-modal-actions">
              <Button variant="ghost" onClick={() => setRenameId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (renameId) {
                    const validation = renameSchema.safeParse(renameTitle.trim());
                    if (!validation.success) {
                      setRenameError(validation.error.errors[0]?.message || "Invalid title");
                      return;
                    }
                    setRenameError(null);
                    renameMutation.mutate({ id: renameId, title: renameTitle.trim() });
                    setRenameId(null);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      </aside>
    </>
  );
};

export default ConversationSidebar;
