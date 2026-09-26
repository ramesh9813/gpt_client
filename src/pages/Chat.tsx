import "./Chat.css";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  clearLastConversationId,
  loadLastConversationId,
  saveLastConversationId,
} from "../features/chat/sidebarState";
import ConversationSidebar from "../features/chat/ConversationSidebar";
import SidebarToggle from "../components/SidebarToggle";
import { useSidebar } from "../features/chat/useSidebar";
import MessageList from "../features/chat/MessageList";
import Composer from "../features/chat/Composer";
import CanvasPanel from "../features/chat/CanvasPanel";
import { buildArtifactData } from "../features/chat/artifact";
import { useChatStreaming } from "../features/chat/hooks/useChatStreaming";
import { useChatModels } from "../features/chat/hooks/useChatModels";
import { useChatMessages } from "../features/chat/hooks/useChatMessages";
import { useSwipeSidebar } from "../features/chat/hooks/useSwipeSidebar";
import { useChatCanvas } from "../features/chat/hooks/useChatCanvas";
import { useChatViewport } from "../features/chat/hooks/useChatViewport";
import { useNewChat } from "./useNewChat";
import { useChatQuiz } from "../features/chat/hooks/useChatQuiz";
import { useChatHeader } from "../features/chat/hooks/useChatHeader";

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
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

  const {
    model,
    setModel,
    resolveModelForPrompt,
    sortBy,
    setSortBy,
    modelOptions,
    modelsLoading,
    modelsTotal,
    modelsUpdatedAt,
    modelsStale,
    modelResetNotice,
    refreshModels,
    modelsRefreshing,
    isGeneralUser,
    byokActive,
  } = useChatModels();

  const {
    messages,
    setMessages,
    lastUserMessage,
    composerError,
    messageData,
    messagesLoading,
    activeTurnKind,
    setActiveTurnKind,
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
    resolveModelForPrompt,
  });

  // Last-open chat: opening another chat replaces the stored one, so a
  // reload always restores the current thread instantly.
  useEffect(() => {
    if (conversationId) saveLastConversationId(conversationId);
  }, [conversationId]);

  // Stale restore guard: stored id was deleted elsewhere → drop it and fall
  // back to HomeRedirect instead of sitting on a dead thread.
  useEffect(() => {
    const code = (messageData?.error as { error?: { code?: string } } | null)
      ?.error?.code;
    if (
      code === "NOT_FOUND" &&
      conversationId &&
      loadLastConversationId() === conversationId
    ) {
      clearLastConversationId();
      navigate("/", { replace: true });
    }
  }, [messageData?.error, conversationId, navigate]);

  const {
    canvasData,
    showCanvas,
    canvasClosing,
    openCanvas,
    closeCanvas,
  } = useChatCanvas(messages);

  // Artifact viewer: Chat-owned state, mirrors canvasData derivation.
  // buildArtifactData scans ASSISTANT messages for ```html:artifact fences
  // (canvas.ts explicitly excludes those, so the two panels never compete).
  // lastUserMessage feeds the title fallback (first 40 chars) when the HTML
  // has no <title> tag.
  const artifactData = useMemo(
    () => buildArtifactData(messages, lastUserMessage || undefined),
    [messages, lastUserMessage]
  );
  // Artifact fences are always stripped from the thread (ArtifactCard replaces
  // the raw HTML); canvas stripping applies only while the canvas is open.
  const combinedOverrides = useMemo(
    () => ({
      ...(showCanvas ? canvasData.displayMap : {}),
      ...artifactData.displayMap,
    }),
    [showCanvas, canvasData.displayMap, artifactData.displayMap]
  );
  const hasOverrides = Object.keys(combinedOverrides).length > 0;

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

  const newChatMutation = useNewChat({ cancelRef, setStreaming, setActiveStreamId, setMessages });

  const { handleHeaderToggle, headerHidden, pinHeader, handleScrollDirection } = useChatHeader({
    isMobile, sidebarState, toggleDrawer, hideSidebar, showSidebar,
  });

  const handleStopStreaming = () => {
    stopStreaming(setMessages);
    setActiveTurnKind(null);
  };

  const { handleQuizSelect, handleNextRound } = useChatQuiz({ conversationId, setMessages, sendMessage });

  return (
    <div className="chat-root">
      <ConversationSidebar
        sidebarState={sidebarState}
        drawerOpen={drawerOpen}
        isMobile={isMobile}
        onExpand={expandSidebar}
        onCollapse={hideSidebar}
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
              conversationKey={conversationId}
              loading={messagesLoading}
              onEditSubmit={handleEditSubmit}
              editDisabled={streaming}
              modelOptions={modelOptions}
              // General users without a provider key can't use built-in
              // models (incl. per-message regenerate alternatives).
              onRegenerate={
                isGeneralUser && !byokActive ? undefined : handleRegenerate
              }
              onStopStreaming={handleStopStreaming}
              onFollowup={(q) => void sendMessage(q)}
              onQuizSelect={handleQuizSelect}
              onNextRound={handleNextRound}
              activeStreamId={activeStreamId}
              activeTurnKind={activeTurnKind}
              contentOverrides={hasOverrides ? combinedOverrides : showCanvas ? canvasData.displayMap : undefined}
              hasCanvasCode={showCanvas ? canvasData.hasCodeMap : undefined}
              artifacts={artifactData.blocks}
              onScrollDirection={handleScrollDirection}
            />
            <Composer
              modelsLoading={modelsLoading}
              onSend={sendMessage}
              disabled={streaming}
              error={composerError}
              isGeneralUser={isGeneralUser}
              lastUserMessage={lastUserMessage}
              model={model}
              modelOptions={modelOptions}
              modelsTotal={modelsTotal}
              modelsUpdatedAt={modelsUpdatedAt}
              modelsStale={modelsStale}
              modelResetNotice={modelResetNotice}
              onRefreshModels={refreshModels}
              modelsRefreshing={modelsRefreshing}
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
