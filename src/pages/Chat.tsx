import "./Chat.css";
import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationSidebar from "../features/chat/ConversationSidebar";
import SidebarToggle from "../components/SidebarToggle";
import { useSidebar } from "../features/chat/useSidebar";
import MessageList from "../features/chat/MessageList";
import Composer from "../features/chat/Composer";
import { apiFetch, ApiResponse } from "../lib/api";
import CanvasPanel from "../features/chat/CanvasPanel";
import { useChatStreaming } from "../features/chat/hooks/useChatStreaming";
import { useChatModels } from "../features/chat/hooks/useChatModels";
import { useChatMessages } from "../features/chat/hooks/useChatMessages";
import { useSwipeSidebar } from "../features/chat/hooks/useSwipeSidebar";
import { useChatCanvas } from "../features/chat/hooks/useChatCanvas";
import { useChatViewport } from "../features/chat/hooks/useChatViewport";
import { useSettings } from "../lib/hooks";

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    sidebarState,
    drawerOpen,
    isMobile,
    expand: expandSidebar,
    collapse: collapseSidebar,
    hide: hideSidebar,
    show: showSidebar,
    toggleCollapse: toggleSidebarCollapse,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  } = useSidebar();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  const {
    streaming,
    setStreaming,
    activeStreamId,
    setActiveStreamId,
    cancelRef,
    streamAssistant,
    stopStreaming,
  } = useChatStreaming();

  const { model, setModel, sortBy, setSortBy, modelOptions, modelsLoading } =
    useChatModels();

  const {
    messages,
    setMessages,
    lastUserMessage,
    composerError,
    sendMessage,
    handleEditSubmit,
    handleRegenerate,
  } = useChatMessages({
    conversationId,
    model,
    setModel,
    streaming,
    setStreaming,
    activeStreamId,
    setActiveStreamId,
    cancelRef,
    streamAssistant,
  });

  const {
    canvasData,
    showCanvas,
    canvasClosing,
    openCanvas,
    closeCanvas,
  } = useChatCanvas(messages);

  useSwipeSidebar({
    isMobile,
    drawerOpen,
    sidebarState,
    openDrawer,
    closeDrawer,
    showSidebar,
    hideSidebar,
    canOpenCanvas: canvasData.blocks.length > 0,
    isCanvasOpen: showCanvas,
    openCanvas,
    closeCanvas,
  });

  useChatViewport(composerInputRef);

  const newChatMutation = useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<{ conversation: { id: string } }>>(
        "/api/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${res.data.conversation.id}`);
    },
  });

  const handleHeaderToggle = () => {
    if (isMobile) {
      toggleDrawer();
    } else if (sidebarState === "hidden") {
      showSidebar();
    } else {
      toggleSidebarCollapse();
    }
  };

  const handleStopStreaming = () => stopStreaming(setMessages);

  // Smart scroll: hide the floating pill on scroll down, reveal on scroll up.
  // Disabled when the user pins the header in Settings > Appearance.
  const [headerHidden, setHeaderHidden] = useState(false);
  const { data: settingsData } = useSettings();
  const pinHeader = settingsData?.data?.settings?.pinHeader ?? false;
  const handleScrollDirection = useCallback((direction: "up" | "down") => {
    setHeaderHidden(direction === "down");
  }, []);

  return (
    <div className="chat-root">
      <ConversationSidebar
        sidebarState={sidebarState}
        drawerOpen={drawerOpen}
        isMobile={isMobile}
        onExpand={expandSidebar}
        onCollapse={collapseSidebar}
        onHide={hideSidebar}
        onCloseDrawer={closeDrawer}
        onOpenDrawer={openDrawer}
      />
      <main className="chat-main">
        {/* Floating action pill — compact, overlays content, wraps icons only */}
        <header
          className={
            headerHidden && !pinHeader
              ? "chat-header chat-header--hidden"
              : "chat-header"
          }
        >
          <div className="chat-header-pill" role="toolbar" aria-label="Chat actions">
            <SidebarToggle
              sidebarState={sidebarState}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              onClick={handleHeaderToggle}
              className="chat-sidebar-toggle"
            />
            <button
              onClick={() => newChatMutation.mutate()}
              disabled={newChatMutation.isPending}
              className="chat-newchat-btn"
              title="New chat"
              aria-label="New chat"
              type="button"
            >
              <i className="bi bi-pencil-square chat-newchat-icon" aria-hidden="true"></i>
            </button>
            {canvasData.blocks.length > 0 ? (
              <>
                <span className="chat-header-divider" aria-hidden="true" />
                <button
                  onClick={() => {
                    if (showCanvas) {
                      closeCanvas();
                    } else {
                      openCanvas();
                    }
                  }}
                  className="chat-canvas-toggle"
                  type="button"
                  title={showCanvas ? "Hide Canvas" : "Show Canvas"}
                  aria-label={showCanvas ? "Hide Canvas" : "Show Canvas"}
                >
                  <i className={`bi ${showCanvas ? "bi-layout-sidebar-inset" : "bi-layout-sidebar-inset-reverse"}`} aria-hidden="true"></i>
                </button>
              </>
            ) : null}
          </div>
        </header>

        <div className="chat-content">
          <section className="chat-thread">
            <MessageList
              messages={messages}
              onEditSubmit={handleEditSubmit}
              editDisabled={streaming}
              modelOptions={modelOptions}
              onRegenerate={handleRegenerate}
              onStopStreaming={handleStopStreaming}
              onFollowup={(q) => void sendMessage(q)}
              activeStreamId={activeStreamId}
              contentOverrides={showCanvas ? canvasData.displayMap : undefined}
              hasCanvasCode={showCanvas ? canvasData.hasCodeMap : undefined}
              onScrollDirection={handleScrollDirection}
            />
            <Composer
              modelsLoading={modelsLoading}
              onSend={sendMessage}
              disabled={streaming}
              error={composerError}
              lastUserMessage={lastUserMessage}
              model={model}
              modelOptions={modelOptions}
              onModelChange={setModel}
              inputRef={composerInputRef}
              sort={sortBy}
              onSortChange={setSortBy}
              streaming={streaming}
              onStop={handleStopStreaming}
            />
          </section>
          {showCanvas ? (
            <CanvasPanel
              blocks={canvasData.blocks}
              closing={canvasClosing}
              onClose={closeCanvas}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Chat;
