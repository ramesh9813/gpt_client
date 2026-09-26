export interface ComposerStatusProps {
  researchArmed: boolean;
  currentModelLabel: string;
  onClearResearch: () => void;
  artifactArmed?: boolean;
  onClearArtifact?: () => void;
  webSearchArmed?: boolean;
  onClearWebSearch?: () => void;
  mcqArmed?: boolean;
  onClearMcq?: () => void;
  thinkingArmed?: boolean;
  onClearThinking?: () => void;
  listening: boolean;
  error?: string | null;
  listenError?: string | null;
}

/**
 * Status rows above the input: armed-research chip, armed-artifact chip,
 * mic visualizer, and error lines. Split from Composer.tsx. No logic changes
 * beyond the additive artifact chip (mirrors research chip exactly).
 */
export const ComposerStatus = ({
  researchArmed,
  currentModelLabel,
  onClearResearch,
  artifactArmed,
  onClearArtifact,
  webSearchArmed,
  onClearWebSearch,
  mcqArmed,
  onClearMcq,
  thinkingArmed,
  onClearThinking,
  listening,
  error,
  listenError,
}: ComposerStatusProps) => {
  return (
    <>
      {researchArmed && (
        <div className="composer-research-chip">
          <i className="bi bi-compass composer-research-icon" aria-hidden="true"></i>
          <span className="composer-research-label" title={currentModelLabel}>
            Deep Research • {currentModelLabel}
          </span>
          <button
            type="button"
            className="composer-research-clear"
            onClick={onClearResearch}
            aria-label="Cancel deep research"
            title="Cancel deep research"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {artifactArmed && (
        <div className="composer-artifact-chip">
          <i className="bi bi-window-stack composer-artifact-icon" aria-hidden="true"></i>
          <span className="composer-artifact-label" title="Artifact preview on send">
            Artifact • Interactive preview
          </span>
          <button
            type="button"
            className="composer-artifact-clear"
            onClick={onClearArtifact}
            aria-label="Cancel artifact mode"
            title="Cancel artifact mode"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {webSearchArmed && (
        <div className="composer-websearch-chip">
          <i className="bi bi-globe-americas composer-websearch-icon" aria-hidden="true"></i>
          <span className="composer-websearch-label" title="Live web search on for this message">
            Web search • Live results
          </span>
          <button
            type="button"
            className="composer-websearch-clear"
            onClick={onClearWebSearch}
            aria-label="Cancel web search"
            title="Cancel web search"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {mcqArmed && (
        <div className="composer-quiz-chip">
          <i className="bi bi-patch-question composer-quiz-icon" aria-hidden="true"></i>
          <span className="composer-quiz-label" title="Quiz mode stays on until cleared">
            Quiz mode • stays on
          </span>
          <button
            type="button"
            className="composer-quiz-clear"
            onClick={onClearMcq}
            aria-label="Cancel quiz mode"
            title="Cancel quiz mode"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {thinkingArmed && (
        <div className="composer-websearch-chip">
          <i className="bi bi-lightbulb composer-websearch-icon" aria-hidden="true"></i>
          <span className="composer-websearch-label" title="Reasoning-capable models will show a Thinking trace">
            Thinking • trace on
          </span>
          <button
            type="button"
            className="composer-websearch-clear"
            onClick={onClearThinking}
            aria-label="Turn thinking mode off"
            title="Turn thinking mode off"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {/* Listening indicator: animated bars while the mic is live */}
      {listening && (
        <div className="composer-viz-wrap" aria-hidden="true">
          <div className="composer-eq">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="composer-eq-bar"
                style={{
                  animationDelay: `${(i % 12) * 0.09}s`,
                  animationDuration: `${0.7 + (i % 5) * 0.12}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {error ? <div className="composer-error">{error}</div> : null}
      {listenError && !listening ? (
        <div className="composer-error">{listenError}</div>
      ) : null}
    </>
  );
};
