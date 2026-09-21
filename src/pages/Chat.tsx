import "./Chat.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  clearLastConversationId,
  loadLastConversationId,
  saveLastConversationId,
} from "../features/chat/sidebarState";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationSidebar from "../features/chat/ConversationSidebar";
import SidebarToggle from "../components/SidebarToggle";
import { useSidebar } from "../features/chat/useSidebar";
import MessageList from "../features/chat/MessageList";
import type { QuizRound } from "../features/chat/MessageList";
import Composer from "../features/chat/Composer";
import { apiFetch, ApiResponse } from "../lib/api";
import CanvasPanel from "../features/chat/CanvasPanel";
import { buildArtifactData } from "../features/chat/artifact";
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
  } = useChatModels();

  const {
    messages,
    setMessages,
    lastUserMessage,
    composerError,
    messageData,
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
    onMutate: () => {
      // Instant feedback: clear thread + stop any stream while POST is in
      // flight, so the UI feels immediate instead of waiting on network.
      try {
        cancelRef.current = true;
      } catch {
        /* noop */
      }
      setStreaming(false);
      setActiveStreamId(null);
      setMessages([]);
    },
    onSuccess: (res) => {
      const conv = res.data.conversation as { id: string };
      // Pre-fill empty messages cache so the new thread renders instantly
      // without waiting for the GET /messages round-trip.
      queryClient.setQueryData(["messages", conv.id], {
        success: true,
        data: { messages: [] },
      });
      // Optimistically prepend to sidebar caches so the list updates without
      // waiting for a full refetch of up to 100 conversations.
      const prepend = (old: unknown) => {
        const o = old as {
          data?: { items?: Array<{ id: string }> };
        } | undefined;
        if (!o?.data?.items) return old;
        return {
          ...(o as object),
          data: {
            ...(o.data as object),
            items: [
              conv,
              ...(o.data.items as Array<{ id: string }>).filter(
                (c) => c.id !== conv.id
              ),
            ],
          },
        };
      };
      queryClient.setQueryData(["conversations"], prepend);
      queryClient.setQueryData(["conversations", ""], prepend);
      // Background revalidation (non-blocking — navigation happens first).
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      navigate(`/c/${conv.id}`);
    },
  });

  const handleHeaderToggle = () => {
    if (isMobile) {
      toggleDrawer();
    } else if (sidebarState === "expanded") {
      // Laptop: minimize completely hides history, chat expands full width.
      // Floating pill stays visible so user can expand again.
      hideSidebar();
    } else {
      showSidebar();
    }
  };

  const handleStopStreaming = () => stopStreaming(setMessages);

  // MCQ quiz: optimistic local update + best-effort persist (no refetch loop).
  const handleQuizSelect = useCallback(
    (messageId: string, quiz: QuizRound) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, quiz } : m))
      );
      if (!conversationId) return;
      const cid = conversationId;
      void apiFetch(`/api/conversations/${cid}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz }),
      }).catch(() => undefined);
    },
    [conversationId, setMessages]
  );

  const handleNextRound = useCallback(
    (topic: string) => {
      const t = topic?.trim() ?? "";
      void sendMessage(t ? `mcq ${t}` : "mcq");
    },
    [sendMessage]
  );

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
              onEditSubmit={handleEditSubmit}
              editDisabled={streaming}
              modelOptions={modelOptions}
              onRegenerate={handleRegenerate}
              onStopStreaming={handleStopStreaming}
              onFollowup={(q) => void sendMessage(q)}
              onQuizSelect={handleQuizSelect}
              onNextRound={handleNextRound}
              activeStreamId={activeStreamId}
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
