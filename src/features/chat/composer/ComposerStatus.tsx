export interface ComposerStatusProps {
  researchArmed: boolean;
  currentModelLabel: string;
  onClearResearch: () => void;
  listening: boolean;
  error?: string | null;
  listenError?: string | null;
}

/**
 * Status rows above the input: armed-research chip, mic visualizer,
 * and error lines. Split from Composer.tsx. No logic changes.
 */
export const ComposerStatus = ({
  researchArmed,
  currentModelLabel,
  onClearResearch,
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
