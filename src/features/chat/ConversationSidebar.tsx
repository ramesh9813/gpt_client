import "./ConversationSidebar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { useMe } from "../../lib/hooks";
import type { SidebarState } from "./sidebarState";
import { cn } from "../../lib/utils";
import type { Conversation } from "./sidebar/types";
import { useSidebarData } from "./sidebar/useSidebarData";
import { useConversationMutations } from "./sidebar/conversationMutations";
import { ConversationRow } from "./sidebar/ConversationRow";
import { FolderSection } from "./sidebar/FolderSection";
import { HistorySection } from "./sidebar/HistorySection";
import { SidebarRail } from "./sidebar/SidebarRail";
import { AccountFooter } from "./sidebar/AccountFooter";
import { SidebarHeader } from "./sidebar/SidebarHeader";

export type { Conversation, Folder } from "./sidebar/types";

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
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const asideRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
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

  const {
    folders,
    groupedConversations,
    uncategorized,
    expandedFolders,
    toggleFolder,
  } = useSidebarData(search);

  const {
    createMutation,
    createFolderMutation,
    renameMutation,
    pinMutation,
    deleteMutation,
    moveMutation,
    deleteFolderMutation,
  } = useConversationMutations({
    isMobile,
    onCloseDrawer,
    menuOpen,
    activeConversationId: params.conversationId,
    onFolderCreated: () => {
      setIsCreatingFolder(false);
      setNewFolderName("");
    },
  });

  const renameSchema = useMemo(
    () => z.string().min(1, "Title is required").max(80, "Max 80 characters"),
    []
  );

  const handleSelectConversation = (id: string) => {
    navigate(`/c/${id}`);
    if (isMobile) onCloseDrawer();
  };

  const renderConversation = (conversation: Conversation) => {
    const active = params.conversationId === conversation.id;
    return (
      <ConversationRow
        key={conversation.id}
        conversation={conversation}
        active={active}
        menuOpen={menuOpen}
        onSelect={handleSelectConversation}
        onToggleMenu={(id) => setMenuOpen((prev) => (prev === id ? null : id))}
        onCloseMenu={() => setMenuOpen(null)}
        onRename={(c) => {
          setRenameId(c.id);
          setRenameTitle(c.title);
          setRenameError(null);
          setMenuOpen(null);
        }}
        onDelete={(id) => {
          deleteMutation.mutate(id);
          setMenuOpen(null);
        }}
        onPin={(c) => {
          pinMutation.mutate({ id: c.id, pinned: !c.pinned });
          setMenuOpen(null);
        }}
        folders={folders}
        onMove={(id, folderId) => {
          moveMutation.mutate({ id, folderId });
          setMenuOpen(null);
        }}
      />
    );
  };

  const showBackdrop = isMobile && drawerOpen;
  const isCollapsedDesktop = !isMobile && sidebarState === "collapsed";

  const asideClasses = cn(
    "conv-side",
    "side-ui",
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
          className="conv-side-backdrop side-ui-backdrop"
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
          <SidebarRail
            onExpand={onExpand}
            onHide={onHide}
            onNewChat={() => createMutation.mutate(undefined)}
          />
        )}

        <div
          ref={panelRef}
          className={cn(
            "conv-side-panel",
            "side-ui-panel",
            !isMobile && sidebarState === "collapsed" ? "conv-side-panel--hidden" : "conv-side-panel--visible"
          )}
          aria-hidden={!isMobile && sidebarState !== "expanded"}
        >
          <SidebarHeader
            onNewChat={() => createMutation.mutate(undefined)}
            isMobile={isMobile}
            drawerOpen={drawerOpen}
            sidebarState={sidebarState}
            onCollapse={onCollapse}
            onHide={onHide}
            onCloseDrawer={onCloseDrawer}
            closeBtnRef={closeBtnRef}
          />

          <div className="conv-side-body side-ui-body">
            <div className="conv-side-search-wrap side-ui-search-wrap">
              <div className="conv-side-search-inner side-ui-search-pill">
                <i className="bi bi-search conv-side-search-icon side-ui-search-icon"></i>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="conv-side-search-input side-ui-search-input"
                />
              </div>
            </div>
            <div className="conv-side-scroll scrollbar-thin side-ui-scroll">
              <div className="side-ui-sections">
                <FolderSection
                  folders={folders}
                  groupedConversations={groupedConversations}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  isCreatingFolder={isCreatingFolder}
                  newFolderName={newFolderName}
                  onNewFolderNameChange={setNewFolderName}
                  onOpenCreateFolder={() => setIsCreatingFolder(true)}
                  onCancelCreateFolder={() => setIsCreatingFolder(false)}
                  onSubmitCreateFolder={() => createFolderMutation.mutate(newFolderName)}
                  onCreateInFolder={(folderId) => createMutation.mutate(folderId)}
                  folderMenuOpen={folderMenuOpen}
                  onToggleFolderMenu={(id) =>
                    setFolderMenuOpen((prev) => (prev === id ? null : id))
                  }
                  onCloseFolderMenu={() => setFolderMenuOpen(null)}
                  onDeleteFolder={(id) => {
                    deleteFolderMutation.mutate(id);
                    setFolderMenuOpen(null);
                  }}
                  renderConversation={renderConversation}
                />

                <HistorySection
                  conversations={uncategorized}
                  renderConversation={renderConversation}
                />
              </div>
            </div>
            <AccountFooter
              userName={user?.name}
              userEmail={user?.email}
              initial={initial}
              isMobile={isMobile}
              onCloseDrawer={onCloseDrawer}
            />
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
          <div className="conv-side-modal-body side-ui-modal-body">
            <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
            {renameError ? (
              <div className="conv-side-modal-error side-ui-modal-error">
                {renameError}
              </div>
            ) : null}
            <div className="conv-side-modal-actions side-ui-modal-actions">
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
