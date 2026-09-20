import { KeyboardEvent, RefObject, memo } from "react";
import { Textarea } from "../../../components/Textarea";
import type { ChatMessage } from "./types";
import { MessageImages } from "./MessageImages";
import { MarkdownContent } from "./MarkdownContent";
import { CopyButton } from "./MessageButtons";

type UserMessageProps = {
  message: ChatMessage;
  isEditing: boolean;
  editingValue: string;
  setEditingValue: (value: string) => void;
  editingError: string | null;
  savingId: string | null;
  editRef: RefObject<HTMLTextAreaElement>;
  onEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  submitEdit: () => void;
  cancelEdit: () => void;
  startEdit: (message: ChatMessage) => void;
  onEditSubmit?: (id: string, value: string) => Promise<void>;
  editDisabled?: boolean;
};

export const UserMessage = memo(
  ({
    message,
    isEditing,
    editingValue,
    setEditingValue,
    editingError,
    savingId,
    editRef,
    onEditKeyDown,
    submitEdit,
    cancelEdit,
    startEdit,
    onEditSubmit,
    editDisabled
  }: UserMessageProps) => {
  return (
    <div
      className={`msg-user-row ${isEditing ? "msg-user-row--editing" : ""}`}
    >
      <div className={`msg-user-col ${isEditing ? "msg-user-col--editing" : "msg-user-col--default"}`}>
        <div className="user-message-card msg-user-card">
          {isEditing ? (
            <div className="msg-user-edit-wrap">
              <MessageImages images={message.images} />
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
  prev.editingError === next.editingError &&
  prev.savingId === next.savingId &&
  prev.editDisabled === next.editDisabled
);
