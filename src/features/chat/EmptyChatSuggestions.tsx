import { useMemo } from "react";
import { pickRandomSuggestions } from "./suggestions";
import "./EmptyChatSuggestions.css";

type EmptyChatSuggestionsProps = {
  /** Re-pick 3 random questions whenever this changes (pass conversationId). */
  conversationKey?: string;
  onSelect: (question: string) => void;
};

const EmptyChatSuggestions = ({
  conversationKey,
  onSelect,
}: EmptyChatSuggestionsProps) => {
  // Random 3 per empty conversation; stable while the user stays on it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => pickRandomSuggestions(3), [conversationKey]);

  return (
    <div
      className="empty-suggest"
      role="group"
      aria-label="Suggested questions"
    >
      <div className="empty-suggest-inner">
        <h2 className="empty-suggest-title">What can I help with?</h2>
        <p className="empty-suggest-sub">Tap a question to ask it instantly</p>
        <div className="empty-suggest-list">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              className="empty-suggest-card"
              onClick={() => onSelect(q)}
            >
              <span className="empty-suggest-text">{q}</span>
              <i
                className="bi bi-arrow-up-right empty-suggest-icon"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmptyChatSuggestions;
