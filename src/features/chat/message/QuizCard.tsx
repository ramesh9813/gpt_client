import "./QuizCard.css";
import type { QuizRound } from "./types";

type QuizCardProps = {
  quiz: QuizRound;
  disabled?: boolean;
  onSelect: (qIndex: number, optIndex: number) => void;
  onNextRound: () => void;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export const QuizCard = ({
  quiz,
  disabled,
  onSelect,
  onNextRound,
}: QuizCardProps) => {
  const total = quiz.questions.length;
  if (total === 0) {
    return null;
  }

  const selections: (number | null)[] =
    Array.isArray(quiz.selections) && quiz.selections.length === total
      ? quiz.selections
      : Array(total).fill(null);

  const answeredCount = selections.filter(
    (s) => s !== null && s !== undefined
  ).length;
  const allAnswered = answeredCount === total;
  const isRevealed = quiz.revealed === true || allAnswered;
  const score = quiz.questions.reduce(
    (acc, q, i) => acc + (selections[i] === q.answerIndex ? 1 : 0),
    0
  );
  const isDisabled = Boolean(disabled);

  return (
    <div
      className="quiz-card"
      role="group"
      aria-label={`Quiz round ${quiz.round}: ${quiz.topic || "Quiz"}`}
    >
      <div className="quiz-card-head">
        <div className="quiz-card-title">
          <i
            className="bi bi-patch-question quiz-card-title-icon"
            aria-hidden="true"
          ></i>
          <span className="quiz-card-topic">
            Round {quiz.round}
            {quiz.topic ? ` • ${quiz.topic}` : ""}
          </span>
        </div>
      </div>

      <ol className="quiz-card-list">
        {quiz.questions.map((q, qi) => {
          const sel = selections[qi];
          const answered =
            sel !== null && sel !== undefined;
          const questionLocked = isDisabled || answered || isRevealed;

          return (
            <li key={qi} className="quiz-card-q">
              <div className="quiz-card-q-title">
                {qi + 1}. {q.question}
              </div>
              <div
                className="quiz-card-opts"
                role="group"
                aria-label={`Question ${qi + 1}`}
              >
                {q.options.map((opt, oi) => {
                  const isPicked = sel === oi;
                  const isCorrect = oi === q.answerIndex;
                  let cls = "quiz-card-opt";
                  if (isRevealed) {
                    if (isCorrect) {
                      cls += " quiz-card-opt--correct";
                    } else if (isPicked) {
                      cls += " quiz-card-opt--wrong";
                    } else {
                      cls += " quiz-card-opt--dim";
                    }
                  } else if (isPicked) {
                    cls += " quiz-card-opt--selected";
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={cls}
                      disabled={questionLocked}
                      aria-pressed={isPicked}
                      aria-label={`Question ${qi + 1} option ${OPTION_LABELS[oi]}: ${opt}`}
                      onClick={() => onSelect(qi, oi)}
                    >
                      <span
                        className="quiz-card-opt-letter"
                        aria-hidden="true"
                      >
                        {OPTION_LABELS[oi]}
                      </span>
                      <span className="quiz-card-opt-text">{opt}</span>
                      {isRevealed && isCorrect ? (
                        <i
                          className="bi bi-check-circle quiz-card-opt-icon"
                          aria-hidden="true"
                        ></i>
                      ) : null}
                      {isRevealed && isPicked && !isCorrect ? (
                        <i
                          className="bi bi-x-circle quiz-card-opt-icon"
                          aria-hidden="true"
                        ></i>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {isRevealed && q.explanation ? (
                <div className="quiz-card-expl">{q.explanation}</div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="quiz-card-foot">
        <div
          className={isRevealed ? "quiz-card-score" : "quiz-card-progress"}
          aria-live="polite"
        >
          {isRevealed ? `Score ${score}/${total}` : `${answeredCount}/${total} answered`}
        </div>
        {isRevealed ? (
          <button
            type="button"
            className="quiz-card-next"
            onClick={onNextRound}
            disabled={isDisabled}
            aria-label={`Next round of ${quiz.topic || "quiz"}`}
          >
            Next round <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default QuizCard;
