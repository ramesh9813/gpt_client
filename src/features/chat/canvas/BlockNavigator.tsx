import type { CanvasBlock } from "../canvas";
import { CopyButton } from "./CopyButton";

type BlockNavigatorProps = {
  blocks: CanvasBlock[];
  activeId: string | null;
  activeIndex: number;
  mode: "code" | "preview";
  previewable: boolean;
  copyText?: string;
  onSelect: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleMode: () => void;
};

export const BlockNavigator = ({
  blocks,
  activeId,
  activeIndex,
  mode,
  previewable,
  copyText,
  onSelect,
  onPrev,
  onNext,
  onToggleMode,
}: BlockNavigatorProps) => {
  return (
    <div className="canvas-toolbar">
      <button
        className="canvas-nav-btn"
        onClick={onPrev}
        disabled={activeIndex <= 0}
        title="Previous block"
        type="button"
      >
        <i className="bi bi-chevron-left canvas-nav-icon"></i>
      </button>
      <select
        className="canvas-select"
        value={activeId ?? undefined}
        onChange={(event) => onSelect(event.target.value)}
      >
        {blocks.map((block, index) => (
          <option key={block.id} value={block.id}>
            {index + 1}. {block.language || "text"} • Msg {block.sourceIndex}
          </option>
        ))}
      </select>
      <button
        className="canvas-nav-btn"
        onClick={onNext}
        disabled={activeIndex >= blocks.length - 1}
        title="Next block"
        type="button"
      >
        <i className="bi bi-chevron-right canvas-nav-icon"></i>
      </button>
      {previewable ? (
        <button
          onClick={onToggleMode}
          className="canvas-preview-toggle"
          title="Toggle preview"
          type="button"
        >
          <i className={`bi ${mode === "preview" ? "bi-code-slash" : "bi-eye"}`}></i>
          {mode === "preview" ? "Code" : "Preview"}
        </button>
      ) : null}
      {copyText ? <CopyButton text={copyText} /> : null}
    </div>
  );
};

export default BlockNavigator;
