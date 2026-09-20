import type { ReactNode } from "react";
import type { Conversation } from "./types";

export interface HistorySectionProps {
  conversations: Conversation[];
  renderConversation: (conversation: Conversation) => ReactNode;
}

export function HistorySection({ conversations, renderConversation }: HistorySectionProps) {
  return (
    <div className="conv-side-section">
      <div className="conv-side-history-head">
        <span className="conv-side-section-label">History</span>
      </div>
      <div className="conv-side-history-list">
        {conversations.map(renderConversation)}
      </div>
    </div>
  );
}
