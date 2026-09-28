import "./ConversationSidebar.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "../../components/Input";
import { useMe } from "../../lib/hooks";
import type { SidebarState } from "./sidebarState";
import { cn } from "../../lib/utils";
import type { Conversation, Folder } from "./sidebar/types";
import { useSidebarData } from "./sidebar/useSidebarData";
import { useConversationMutations } from "./sidebar/conversationMutations";
import { ConversationRow } from "./sidebar/ConversationRow";
import { FolderSection } from "./sidebar/FolderSection";
import { HistorySection } from "./sidebar/HistorySection";
import { SidebarRail } from "./sidebar/SidebarRail";
import { AccountFooter } from "./sidebar/AccountFooter";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { RenameModal } from "./sidebar/RenameModal";
import { TuningModal } from "./sidebar/TuningModal";
import { readCachedConversations, writeCachedConversations, readCachedFolders, writeCachedFolders } from "./chatCache";

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
  const [tuningId, setTuningId] = useState<string | null>(null);
  const [folderTuningId, setFolderTuningId] = useState<string | null>(null);

  const asideRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
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
        onTuning={(c) => {
          setTuningId(c.id);
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
  // Laptop rail is hidden by CSS (collapsed = hidden = 0px full-screen chat).
  // Kept for Android parity only — never renders on desktop due to lg-only CSS.
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
            !isMobile && sidebarState !== "expanded" ? "conv-side-panel--hidden" : "conv-side-panel--visible"
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
                  onTuneFolder={(id) => setFolderTuningId(id)}
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
        <RenameModal
          renameId={renameId}
          renameTitle={renameTitle}
          renameError={renameError}
          onTitleChange={setRenameTitle}
          onClose={() => {
            setRenameId(null);
            setRenameError(null);
          }}
          onInvalid={setRenameError}
          onSave={(title) => {
            if (renameId) {
              setRenameError(null);
              renameMutation.mutate({ id: renameId, title });
              setRenameId(null);
            }
          }}
        />
        <TuningModal
          conversationId={tuningId}
          conversationTitle={
            tuningId ? ([...uncategorized, ...Object.values(groupedConversations).flat()].find((c) => c.id === tuningId)?.title ?? undefined) : undefined
          }
          open={!!tuningId}
          onClose={() => setTuningId(null)}
          onSaved={(cfg) => {
            if (!tuningId) return;
            // Patch conversation cache so the tuning dot appears instantly.
            const patch = (old: unknown) => {
              const o = old as { data?: { items?: Conversation[] } } | undefined;
              if (!o?.data?.items) return old;
              return { ...(o as object), data: { ...(o.data as object), items: (o.data.items as Conversation[]).map((c) => c.id === tuningId ? { ...c, customPrompt: cfg.customPrompt, customPromptEnabled: cfg.customPromptEnabled } : c) } };
            };
            const k1 = queryClient.getQueryData(["conversations"]) as { data?: { items?: Conversation[] } } | undefined;
            const k2 = queryClient.getQueryData(["conversations", ""]) as { data?: { items?: Conversation[] } } | undefined;
            queryClient.setQueryData(["conversations"], patch(k1));
            queryClient.setQueryData(["conversations", ""], patch(k2));
            // Also persist for instant paint on reload.
            const combined = (() => {
              const a = (k1?.data?.items ?? []);
              const b = (k2?.data?.items ?? []);
              const map = new Map<string, Conversation>();
              [...a, ...b].forEach((c) => map.set(c.id, c));
              return [...map.values()];
            })();
            const patched = combined.map((c) => c.id === tuningId ? { ...c, customPrompt: cfg.customPrompt, customPromptEnabled: cfg.customPromptEnabled } : c);
            if (patched.length > 0) writeCachedConversations(patched);
            // Fallback: also write raw cached list directly
            const raw = readCachedConversations();
            if (raw) writeCachedConversations(raw.map((c) => c.id === tuningId ? { ...c, customPrompt: cfg.customPrompt, customPromptEnabled: cfg.customPromptEnabled } as Conversation : c));
          }}
        />
        <TuningModal
          conversationId={null}
          folderId={folderTuningId}
          folderTitle={
            folderTuningId ? (folders.find((f) => f.id === folderTuningId)?.name ?? undefined) : undefined
          }
          open={!!folderTuningId}
          onClose={() => setFolderTuningId(null)}
          onSaved={(cfg) => {
            if (!folderTuningId) return;
            // Patch folders cache so the count badge recolors instantly.
            const patchFolders = (old: unknown) => {
              const o = old as { data?: { items?: Folder[] } } | undefined;
              if (!o?.data?.items) return old;
              return { ...(o as object), data: { ...(o.data as object), items: (o.data.items as Folder[]).map((f) => f.id === folderTuningId ? { ...f, customPrompt: cfg.customPrompt, customPromptEnabled: cfg.customPromptEnabled } : f) } };
            };
            const fk = queryClient.getQueryData(["folders"]);
            queryClient.setQueryData(["folders"], patchFolders(fk));
            const rawFolders = readCachedFolders();
            if (rawFolders) writeCachedFolders(rawFolders.map((f) => f.id === folderTuningId ? { ...f, customPrompt: cfg.customPrompt, customPromptEnabled: cfg.customPromptEnabled } : f));
            else queryClient.invalidateQueries({ queryKey: ["folders"] });
          }}
        />
      </aside>
    </>
  );
};

export default ConversationSidebar;
