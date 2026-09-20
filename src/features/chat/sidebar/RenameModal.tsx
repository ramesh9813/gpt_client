import { useMemo } from "react";
import { z } from "zod";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";

export interface RenameModalProps {
  renameId: string | null;
  renameTitle: string;
  renameError: string | null;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
  onSave: (title: string) => void;
}

/**
 * Rename-conversation dialog (validates title itself).
 * Split from ConversationSidebar.tsx. No logic changes.
 */
export const RenameModal = ({
  renameId,
  renameTitle,
  renameError,
  onTitleChange,
  onClose,
  onInvalid,
  onSave,
}: RenameModalProps) => {
  const schema = useMemo(
    () => z.string().min(1, "Title is required").max(80, "Max 80 characters"),
    []
  );
  return (
    <Modal open={!!renameId} title="Rename conversation" onClose={onClose}>
      <div className="conv-side-modal-body side-ui-modal-body">
        <Input value={renameTitle} onChange={(e) => onTitleChange(e.target.value)} />
        {renameError ? (
          <div className="conv-side-modal-error side-ui-modal-error">
            {renameError}
          </div>
        ) : null}
        <div className="conv-side-modal-actions side-ui-modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!renameId) return;
              const validation = schema.safeParse(renameTitle.trim());
              if (!validation.success) {
                onInvalid(
                  validation.error.errors[0]?.message || "Invalid title"
                );
                return;
              }
              onSave(validation.data);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};
