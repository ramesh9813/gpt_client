export interface ComposerStatusProps {
  listening: boolean;
  processing?: boolean;
  progress?: number;
  error?: string | null;
  listenError?: string | null;
}

/**
 * Status area above the input: mic visualizer + processing spinner + errors.
 * Record-then-transcribe flow: RECORDING shows the recording indicator (EQ
 * bars), PROCESSING shows a visible spinner while the whole clip is decoded
 * + transcribed, then the transcript lands in the textarea for review.
 * Mode chips (research/artifact/search/quiz/thinking) were removed on purpose:
 * enabled modes show as colored icons in the input toolbar instead of extra
 * cards inside the input card.
 */
export const ComposerStatus = ({
  listening,
  processing = false,
  progress = 0,
  error,
  listenError,
}: ComposerStatusProps) => {
  return (
    <>
      {/* RECORDING indicator: animated bars while the mic is capturing */}
      {listening && (
        <div
          className="composer-viz-wrap"
          role="status"
          aria-label="Recording voice input"
        >
          <div className="composer-eq" aria-hidden="true">
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
          <div className="composer-file-hint">Recording… tap mic to stop</div>
        </div>
      )}

      {/* PROCESSING indicator: visible spinner while the whole recorded
          audio is decoded + transcribed on-device */}
      {!listening && processing && (
        <div
          className="composer-viz-wrap"
          role="status"
          aria-label="Processing voice input"
        >
          <div className="composer-file-hint">
            <i className="bi bi-hourglass-split" aria-hidden="true" />{" "}
            Processing voice…
            {progress > 0 ? ` ${progress}%` : ""}
          </div>
        </div>
      )}

      {error ? <div className="composer-error">{error}</div> : null}
      {listenError && !listening && !processing ? (
        <div className="composer-error">{listenError}</div>
      ) : null}
    </>
  );
};
