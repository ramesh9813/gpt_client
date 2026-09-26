export interface ComposerStatusProps {
  listening: boolean;
  error?: string | null;
  listenError?: string | null;
}

/**
 * Status area above the input: mic visualizer + error lines only.
 * Mode chips (research/artifact/search/quiz/thinking) were removed on purpose:
 * enabled modes show as colored icons in the input toolbar instead of extra
 * cards inside the input card.
 */
export const ComposerStatus = ({
  listening,
  error,
  listenError,
}: ComposerStatusProps) => {
  return (
    <>
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
