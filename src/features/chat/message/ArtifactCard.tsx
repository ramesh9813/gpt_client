import "./ArtifactCard.css";
import type { ArtifactBlock } from "../artifact";

type ArtifactCardProps = {
  artifact: ArtifactBlock;
  onOpenArtifact?: (artifact: ArtifactBlock) => void;
};

export const ArtifactCard = ({ artifact, onOpenArtifact }: ArtifactCardProps) => {
  const title = artifact.title?.trim() || "Interactive Simulation";

  return (
    <div
      className="artifact-card"
      role="group"
      aria-label={`Interactive simulation: ${title}`}
    >
      <div className="artifact-card-icon" aria-hidden="true">
        <i className="bi bi-play-circle artifact-card-icon-glyph"></i>
      </div>
      <div className="artifact-card-text">
        <div className="artifact-card-label">Interactive Simulation Created</div>
        <div className="artifact-card-title" title={title}>
          {title}
        </div>
      </div>
      <button
        type="button"
        className="artifact-card-open"
        onClick={() => onOpenArtifact?.(artifact)}
        title="Open interactive preview"
        aria-label={`Open interactive simulation: ${title}`}
      >
        <i className="bi bi-arrows-angle-expand" aria-hidden="true"></i>
        <span className="artifact-card-open-text" aria-hidden="true">
          Open
        </span>
      </button>
    </div>
  );
};

export default ArtifactCard;
