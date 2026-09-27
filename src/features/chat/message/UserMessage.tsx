import { KeyboardEvent, RefObject, memo } from "react";
import { Textarea } from "../../../components/Textarea";
import type { ChatMessage } from "./types";
import { MessageImages } from "./MessageImages";
import { MarkdownContent } from "./MarkdownContent";
import { CopyButton } from "./MessageButtons";
import { useDoubleCopy } from "./useDoubleCopy";

type UserMessageProps = {
  message: ChatMessage;
  isEditing: boolean;
  editingValue: string;
  setEditingValue: (value: string) => void;
  editingImages: string[];
  onRemoveEditingImage: (index: number) => void;
  editingError: string | null;
  savingId: string | null;
  editRef: RefObject<HTMLTextAreaElement>;
  onEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  submitEdit: () => void;
  cancelEdit: () => void;
  startEdit: (message: ChatMessage) => void;
  onEditSubmit?: (id: string, value: string, images?: string[]) => Promise<void>;
  editDisabled?: boolean;
  onResend?: (messageId: string) => void;
};

export const UserMessage = memo(
  ({
    message,
    isEditing,
    editingValue,
    setEditingValue,
    editingImages,
    onRemoveEditingImage,
    editingError,
    savingId,
    editRef,
    onEditKeyDown,
    submitEdit,
    cancelEdit,
    startEdit,
    onEditSubmit,
  editDisabled,
  onResend,
}: UserMessageProps) => {
  // Double fast click / double tap on the bubble copies it immediately.
  const { copied, onDoubleClick, onTouchStart, onTouchEnd } = useDoubleCopy(
    () => message.content
  );
  return (
    <div
      className={`msg-user-row ${isEditing ? "msg-user-row--editing" : ""}`}
    >
      <div className={`msg-user-col ${isEditing ? "msg-user-col--editing" : "msg-user-col--default"}`}>
        <div
          className="user-message-card msg-user-card"
          {...(!isEditing
            ? {
                onDoubleClick,
                onTouchStart,
                onTouchEnd,
                title: "Double-click to copy",
              }
            : {})}
        >
          {copied && !isEditing ? (
            <span className="msg-copy-flash" aria-live="polite">
              Copied
            </span>
          ) : null}
          {isEditing ? (
            <div className="msg-user-edit-wrap">
              {editingImages.length > 0 ? (
                <div className="msg-images msg-images--editable">
                  {editingImages.map((src, i) => (
                    <div key={i} className="msg-image-wrap">
                      <img
                        src={src}
                        alt={`Attachment ${i + 1}`}
                        loading="lazy"
                        className="msg-image"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveEditingImage(i)}
                        aria-label={`Remove image ${i + 1} (not sent on save)`}
                        title="Remove image"
                        className="msg-image-remove"
                      >
                        <i className="bi bi-x msg-image-remove-icon" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Textarea
                ref={editRef}
                rows={2}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={onEditKeyDown}
                className="msg-user-edit-input"
                aria-invalid={!!editingError}
              />
              {editingError ? (
                <div className="msg-user-edit-error">
                  {editingError}
                </div>
              ) : null}
              <div className="msg-user-edit-actions">
                <button
                  className="msg-user-edit-cancel"
                  onClick={cancelEdit}
                  disabled={savingId === message.id}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="msg-user-edit-save"
                  onClick={submitEdit}
                  disabled={savingId === message.id}
                  type="button"
                >
                  {savingId === message.id ? "Saving..." : "Save & run"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <MessageImages images={message.images} />
              {message.content.trim().length > 0 ? (
                <MarkdownContent content={message.content} />
              ) : null}
            </>
          )}
        </div>
        {!isEditing && (
          <div className="msg-user-actions">
            <CopyButton
              text={message.content}
              showText={false}
            />
            {onEditSubmit && !editDisabled && (
              <button
                className="msg-icon-btn"
                onClick={() => startEdit(message)}
                disabled={editDisabled}
                title="Edit message"
                aria-label="Edit message"
                type="button"
              >
                <i className="bi bi-pencil msg-action-icon"></i>
              </button>
            )}
            {onResend && !editDisabled && (
              <button
                className="msg-icon-btn"
                onClick={() => onResend(message.id)}
                disabled={editDisabled}
                title="Resend to same model"
                aria-label="Resend to same model"
                type="button"
              >
                <i className="bi bi-arrow-repeat msg-action-icon"></i>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
},
// Only the edited row (new message identity) or edit-state changes re-render.
// Streaming replaces just the streaming message object, so settled rows skip.
(prev, next) =>
  prev.message === next.message &&
  prev.isEditing === next.isEditing &&
  prev.editingValue === next.editingValue &&
  prev.editingImages === next.editingImages &&
  prev.editingError === next.editingError &&
  prev.savingId === next.savingId &&
  prev.editDisabled === next.editDisabled
);
