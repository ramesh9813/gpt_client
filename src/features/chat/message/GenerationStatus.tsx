import type { TurnKind } from "./types";

const STATUS_META: Record<
  Exclude<TurnKind, "text">,
  { icon: string; label: string }
> = {
  websearch: {
    icon: "bi-globe-americas",
    label: "Searching the web across multiple sources",
  },
  research: { icon: "bi-compass", label: "Researching deeply" },
  artifact: { icon: "bi-window-stack", label: "Planning artifact" },
  mcq: { icon: "bi-patch-question", label: "Generating quiz questions" },
  image: { icon: "bi-image", label: "Generating image" },
  video: { icon: "bi-camera-video", label: "Generating video" },
};

export const GenerationStatus = ({ kind }: { kind: TurnKind }) => {
  if (kind === "text") return null;
  const meta = STATUS_META[kind];
  const showMediaSlot = kind === "image" || kind === "video";
  return (
    <div
      className="msg-gen-status"
      role="status"
      aria-label={meta.label}
      aria-live="polite"
    >
      {showMediaSlot && (
        <div
          className={`msg-gen-media${kind === "video" ? " msg-gen-media--video" : ""}`}
          aria-hidden="true"
        />
      )}
      <div className="msg-gen-status-row">
        <i className={`bi ${meta.icon} msg-gen-status-icon`} aria-hidden="true" />
        <span className="msg-gen-status-label">{meta.label}</span>
        <span className="msg-gen-status-dots" aria-hidden="true">
          <span className="msg-gen-status-dot msg-gen-status-dot--1" />
          <span className="msg-gen-status-dot msg-gen-status-dot--2" />
          <span className="msg-gen-status-dot msg-gen-status-dot--3" />
        </span>
      </div>
    </div>
  );
};

export default GenerationStatus;
