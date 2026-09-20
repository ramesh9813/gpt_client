import { RefObject, memo, useMemo } from "react";
import { DownloadMenu } from "../../../components/DownloadMenu";
import type { ChatMessage, ModelOption, QuizRound } from "./types";
import type { ArtifactBlock } from "../artifact";
import { MessageImages } from "./MessageImages";
import { VideoBlock } from "./VideoBlock";
import { MarkdownContent } from "./MarkdownContent";
import { CopyButton, ShareButton } from "./MessageButtons";
import { RegenerateMenu } from "./RegenerateMenu";
import { QuizCard } from "./QuizCard";
import { ArtifactCard } from "./ArtifactCard";

type AssistantMessageProps = {
  message: ChatMessage;
  displayContent: string;
  isCanvasOnly: boolean;
  messages: ChatMessage[];
  modelOptions?: ModelOption[];
  onRegenerate?: (messageId: string, model: string) => void;
  onStopStreaming?: () => void;
  onFollowup?: (text: string) => void;
  onQuizSelect?: (messageId: string, quiz: QuizRound) => void;
  onNextRound?: (topic: string) => void;
  activeStreamId?: string | null;
  listRef: RefObject<HTMLDivElement>;
  artifacts?: ArtifactBlock[];
  onOpenArtifact?: (artifact: ArtifactBlock) => void;
};

export const AssistantMessage = memo(
  ({
    message,
    displayContent,
    isCanvasOnly,
    messages,
    modelOptions = [],
    onRegenerate,
    onStopStreaming,
    onFollowup,
    onQuizSelect,
    onNextRound,
    activeStreamId,
    listRef,
    artifacts,
    onOpenArtifact
  }: AssistantMessageProps) => {
  const messageArtifacts = useMemo(
    () =>
      artifacts && artifacts.length > 0
        ? artifacts.filter((a) => a.messageId === message.id)
        : [],
    [artifacts, message.id]
  );

  if (!message.content && !(message.images && message.images.length > 0) && !(message.videos && message.videos.length > 0) && !message.quiz && message.status !== "STREAMING" && messageArtifacts.length === 0) {
    return null;
  }

  const handleQuizSelect = (qIndex: number, optIndex: number) => {
    const quiz = message.quiz;
    if (!quiz) return;
    const total = quiz.questions.length;
    if (qIndex < 0 || qIndex >= total) return;
    if (optIndex < 0 || optIndex > 3) return;
    const prevSel: (number | null)[] =
      Array.isArray(quiz.selections) && quiz.selections.length === total
        ? [...quiz.selections]
        : Array(total).fill(null);
    if (prevSel[qIndex] !== null && prevSel[qIndex] !== undefined) return;
    prevSel[qIndex] = optIndex;
    const allAnswered = prevSel.every((s) => s !== null && s !== undefined);
    const next: QuizRound = {
      ...quiz,
      selections: prevSel,
      revealed: allAnswered ? true : (quiz.revealed ?? false),
    };
    onQuizSelect?.(message.id, next);
  };

  const handleNextRound = () => {
    if (!message.quiz) return;
    onNextRound?.(message.quiz.topic);
  };

  return (
    <div
      className="msg-assistant"
    >
      <div className="markdown msg-assistant-body">
        <MessageImages images={message.images} />
        <VideoBlock videos={message.videos} />
        {message.status === "STREAMING" && !displayContent && !message.quiz ? (
          <div className="msg-typing">
            <div className="msg-typing-dot msg-typing-dot--1"></div>
            <div className="msg-typing-dot msg-typing-dot--2"></div>
            <div className="msg-typing-dot msg-typing-dot--3"></div>
          </div>
        ) : isCanvasOnly ? (
          <div className="msg-canvas-notice">
            Code sent to Canvas
          </div>
        ) : (
          <>
            {messageArtifacts.length > 0 ? (
              <div className="msg-artifacts">
                {messageArtifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    onOpenArtifact={onOpenArtifact}
                  />
                ))}
              </div>
            ) : null}
            {displayContent ? <MarkdownContent content={displayContent} /> : null}
          </>
        )}
        {message.quiz && message.quiz.questions.length > 0 ? (
          <QuizCard
            quiz={message.quiz}
            disabled={message.status === "STREAMING"}
            onSelect={handleQuizSelect}
            onNextRound={handleNextRound}
          />
        ) : null}
        {message.followups && message.followups.length > 0 && message.status === "COMPLETE" ? (
          <div className="msg-followups">
            {message.followups.map((q, i) => (
              <button
                key={i}
                type="button"
                className="msg-followup-chip"
                onClick={() => onFollowup?.(q)}
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        <div className="msg-assistant-footer">
          {message.model && (
            <div className="msg-model-label">
              {message.model.split('/').pop()}
            </div>
          )}
          {message.status === "STREAMING" ? (
            <>
              {onStopStreaming && activeStreamId === message.id ? (
                <button
                  className="msg-icon-btn"
                  onClick={onStopStreaming}
                  title="Stop response"
                  aria-label="Stop response"
                  type="button"
                >
                  <i className="bi bi-stop-circle msg-action-icon"></i>
                </button>
              ) : null}
              {message.content && (
                <div className="msg-generating" title="Generating...">
                  <div className="msg-generating-dot msg-generating-dot--1"></div>
                  <div className="msg-generating-dot msg-generating-dot--2"></div>
                  <div className="msg-generating-dot msg-generating-dot--3"></div>
                </div>
              )}
            </>
          ) : (
            <div className="msg-assistant-actions">
              <CopyButton
                text={message.content}
                showText={false}
              />
              <ShareButton
                text={message.content}
              />
              <DownloadMenu
                content={message.content}
                messages={messages}
                chatContainerRef={listRef}
              />
              {onRegenerate && (
                <RegenerateMenu
                  messageId={message.id}
                  modelOptions={modelOptions}
                  onRegenerate={onRegenerate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
},
// Settled answers skip re-renders while another message streams: only a new
// message identity, new content, canvas/stream flags, or a longer thread
// (new/removed messages) re-render a row. Volatile callbacks, the thread
// array identity, and the shared artifacts array identity are intentionally
// ignored — per-message content identity already covers artifact changes.
(prev, next) =>
  prev.message === next.message &&
  prev.displayContent === next.displayContent &&
  prev.isCanvasOnly === next.isCanvasOnly &&
  prev.activeStreamId === next.activeStreamId &&
  prev.modelOptions === next.modelOptions &&
  prev.messages.length === next.messages.length
);
