import { useState, type ReactNode } from "react";
import type { Conversation } from "./types";

export interface HistorySectionProps {
  conversations: Conversation[];
  renderConversation: (conversation: Conversation) => ReactNode;
}

export function HistorySection({ conversations, renderConversation }: HistorySectionProps) {
  const [historyOpen, setHistoryOpen] = useState(() => {
    try {
      const v = window.localStorage.getItem("chatapp.sidebar.history.open");
      return v === null ? true : v !== "false";
    } catch {
      return true;
    }
  });
  const toggleHistory = () => {
    setHistoryOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("chatapp.sidebar.history.open", String(next));
      } catch {}
      return next;
    });
  };
  return (
    <div className="conv-side-section">
      <div className="conv-side-history-head">
        <button
          type="button"
          className="conv-side-section-toggle"
          onClick={toggleHistory}
          aria-expanded={historyOpen}
          title={historyOpen ? "Minimize history" : "Expand history"}
        >
          <i
            className={`bi ${historyOpen ? "bi-chevron-down" : "bi-chevron-right"} conv-side-section-chev`}
            aria-hidden="true"
          ></i>
          <span className="conv-side-section-label">History</span>
        </button>
      </div>
      {historyOpen && (
        <div className="conv-side-history-list">
          {conversations.map(renderConversation)}
        </div>
      )}
    </div>
  );
}
