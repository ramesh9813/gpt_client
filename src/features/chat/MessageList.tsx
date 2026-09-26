import "./MessageList.css";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../lib/api";
import type { Conversation } from "./sidebar/types";
import type { ChatMessage, ModelOption, QuizRound, TurnKind } from "./message/types";
import type { ArtifactBlock } from "./artifact";
import { useMessageEdit } from "./message/useMessageEdit";
import { useMessageFollow } from "./messagelist/useMessageFollow";
import { LIST_SCROLL_EVENT, publishListScrollState, type ListScrollEdge } from "./messagelist/scrollBus";
import { UserMessage } from "./message/UserMessage";
import { AssistantMessage } from "./message/AssistantMessage";
import EmptyChatSuggestions from "./EmptyChatSuggestions";

export type { ChatMessage, ModelOption, QuizQuestion, QuizRound } from "./message/types";

type MessageListProps = {
  messages: ChatMessage[];
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  onFollowup?: (text: string) => void;
  onQuizSelect?: (messageId: string, quiz: QuizRound) => void;
  onNextRound?: (topic: string) => void;
  activeStreamId?: string | null;
  activeTurnKind?: TurnKind | null;
  contentOverrides?: Record<string, string>;
  hasCanvasCode?: Record<string, boolean>;
  artifacts?: ArtifactBlock[];
  onScrollDirection?: (direction: "up" | "down") => void;
  conversationKey?: string;
  // True while the thread's first page loads: show a skeleton so the shell
  // (sidebar + composer) stays interactive instead of flashing empty state.
  loading?: boolean;
};

const MessageList = ({
  messages,
  onEditSubmit,
  editDisabled,
  modelOptions = [],
  onRegenerate,
  onStopStreaming,
  onFollowup,
  onQuizSelect,
  onNextRound,
  activeStreamId,
  activeTurnKind,
  contentOverrides,
  hasCanvasCode,
  artifacts,
  onScrollDirection,
  conversationKey,
  loading,
}: MessageListProps) => {
  const { listRef, jumpToBottom, scrollToTop } =
    useMessageFollow({
      messages,
      activeStreamId,
      conversationKey,
      onScrollDirection,
      // Feeds the composer's single smart jump button (scroll bus back-channel).
      onScrollState: publishListScrollState,
    });
  const edit = useMessageEdit(onEditSubmit);

  // The jump buttons live pinned above the input card (Composer) and drive
  // the same handlers through the scroll bus — auto-follow logic untouched.
  const followRef = useRef({ scrollToTop, jumpToBottom });
  followRef.current = { scrollToTop, jumpToBottom };
  useEffect(() => {
    const onRequest = (e: Event) => {
      const edge = (e as CustomEvent<ListScrollEdge>).detail;
      if (edge === "top") followRef.current.scrollToTop();
      else followRef.current.jumpToBottom();
    };
    window.addEventListener(LIST_SCROLL_EVENT, onRequest);
    return () => window.removeEventListener(LIST_SCROLL_EVENT, onRequest);
  }, []);

  // Chat name for download filenames (<chatname>.<ext>). Subscribes to the
  // same ["conversations", ""] cache the sidebar fills, so no extra fetch.
  const { data: convList } = useQuery({
    queryKey: ["conversations", ""],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        "/api/conversations?search="
      ),
    staleTime: 1000 * 30,
  });
  const chatName = useMemo(
    () =>
      convList?.data?.items?.find((c) => c.id === conversationKey)?.title,
    [convList, conversationKey]
  );

  return (
    <div className="msg-list scrollbar-thin" ref={listRef}>
      {messages.length === 0 ? (
        loading ? (
          // Silent background fill: UI shell is already up, so messages
          // load with no animation — suggestions appear only once the
          // load finishes genuinely empty.
          <div className="msg-list-inner msg-list-inner--empty" aria-hidden="true" />
        ) : (
        <div className="msg-list-inner msg-list-inner--empty">
          <EmptyChatSuggestions
            conversationKey={conversationKey}
            onSelect={(q) => onFollowup?.(q)}
          />
        </div>
        )
      ) : (
      <div className="msg-list-inner">
        {messages.map((message) => {
          if (message.role === "SYSTEM") {
            return (
              <div key={message.id} className="msg-system">
                {message.content}
              </div>
            );
          }

          if (message.role === "USER") {
            return (
              <UserMessage
                key={message.id}
                message={message}
                isEditing={edit.editingId === message.id}
                editingValue={edit.editingValue}
                setEditingValue={edit.setEditingValue}
                editingError={edit.editingError}
                savingId={edit.savingId}
                editRef={edit.editRef}
                onEditKeyDown={edit.onEditKeyDown}
                submitEdit={edit.submitEdit}
                cancelEdit={edit.cancelEdit}
                startEdit={edit.startEdit}
                onEditSubmit={onEditSubmit}
                editDisabled={editDisabled}
              />
            );
          }

          const displayContent =
            contentOverrides?.[message.id] ?? message.content;
          const isCanvasOnly =
            !!hasCanvasCode?.[message.id] &&
            displayContent.trim().length === 0;

          return (
            <AssistantMessage
              key={message.id}
              message={message}
              displayContent={displayContent}
              isCanvasOnly={isCanvasOnly}
              messages={messages}
              modelOptions={modelOptions}
              onRegenerate={onRegenerate}
              onStopStreaming={onStopStreaming}
              onFollowup={onFollowup}
              onQuizSelect={onQuizSelect}
              onNextRound={onNextRound}
              activeStreamId={activeStreamId}
              activeTurnKind={activeTurnKind}
              listRef={listRef}
              artifacts={artifacts}
              chatName={chatName}
            />
          );
        })}
      </div>
      )}
    </div>
  );
};

export default MessageList;
