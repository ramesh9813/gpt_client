import "./Chat.css";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const { canvasData, showCanvas, setShowCanvas, setCanvasDismissed } =
    useChatCanvas(messages);

  useSwipeSidebar({
    isMobile,
    drawerOpen,
    sidebarState,
    openDrawer,
    closeDrawer,
    showSidebar,
    hideSidebar,
  });

  useChatViewport(composerInputRef);

  const { data: convsData } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Array<{ id: string; title: string }> }>>(
        "/api/conversations"
      ),
  });

  const currentConv = convsData?.data?.items?.find((c) => c.id === conversationId);
  const currentConversationTitle = currentConv?.title;

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
        {/* Top Header Bar with history toggle (always accessible, even when hidden) */}
        <header className="chat-header">
          <div className="chat-header-left">
            <SidebarToggle
              sidebarState={sidebarState}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              onClick={handleHeaderToggle}
              className="chat-sidebar-toggle"
            />
            <div className="chat-title">
              <span className="chat-title-brand">ChatGPT</span>
              {currentConversationTitle && (
                <span className="chat-title-sub">
                  / {currentConversationTitle}
                </span>
              )}
            </div>
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
          </div>

          <div className="chat-header-actions">
            {canvasData.blocks.length > 0 ? (
              <button
                onClick={() => {
                  if (showCanvas) {
                    setShowCanvas(false);
                    setCanvasDismissed(true);
                  } else {
                    setShowCanvas(true);
                    setCanvasDismissed(false);
                  }
                }}
                className="chat-canvas-toggle"
                type="button"
              >
                <i className={`bi ${showCanvas ? "bi-layout-sidebar-inset" : "bi-layout-sidebar-inset-reverse"}`}></i>
                <span className="chat-canvas-label-wide">{showCanvas ? "Hide Canvas" : "Show Canvas"}</span>
                <span className="chat-canvas-label-narrow">Canvas</span>
              </button>
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
              activeStreamId={activeStreamId}
              contentOverrides={showCanvas ? canvasData.displayMap : undefined}
              hasCanvasCode={showCanvas ? canvasData.hasCodeMap : undefined}
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
              onClose={() => {
                setShowCanvas(false);
                setCanvasDismissed(true);
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Chat;
