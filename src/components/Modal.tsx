import { ReactNode } from "react";
import "./Modal.css";

export const Modal = ({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
