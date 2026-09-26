import { ModelSearch } from "./ModelSearch";
import { ModelMenuFooter } from "./ModelMenuFooter";
import { ModelSortMenu } from "./ModelSortMenu";
import { useModelMenuList } from "./useModelMenuList";
import { formatUpdatedAgo } from "../utils/formatUpdatedAgo";
import { getActiveByok } from "../../../lib/byok";
import "./ModelMenu.css";

export type ModelOption = {
  label: string;
  value: string;
  supportsResearch?: boolean;
  supportsImage?: boolean;
  supportsVideo?: boolean;
};
export type SortOption = "name" | "cheapest" | "free" | "speed";

export type ModelsStaleInfo = { offline: boolean; updatedAgo: string };

type ModelMenuProps = {
  model: string;
  modelOptions: ModelOption[];
  modelsLoading?: boolean;
  sort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onModelChange: (value: string) => void;
  currentModelLabel: string;
  modelMenuOpen: boolean;
  menuOpen: boolean;
  onModelMenuOpenChange: (open: boolean) => void;
  onCloseMenu: () => void;
  onResearchSelect?: () => void;
  onArtifactSelect?: () => void;
  researchArmed?: boolean;
  artifactArmed?: boolean;
  onResearchDisarm?: () => void;
  onArtifactDisarm?: () => void;
  // General users run on their own provider key; built-in model/media/
  // research pickers are hidden for them.
  isGeneralUser?: boolean;
  // Toggleable composer modes shown ONLY here when disabled; once armed, the
  // matching icon appears on the input toolbar instead.
  webSearchArmed?: boolean;
  onWebSearchToggle?: () => void;
  mcqArmed?: boolean;
  onMcqToggle?: () => void;
  thinkingArmed?: boolean;
  onThinkingToggle?: () => void;
  // Catalog freshness footer (from useChatModels):
  modelsTotal?: number;
  modelsUpdatedAt?: string | null;
  modelsStale?: ModelsStaleInfo | null;
  modelResetNotice?: string | null;
  onRefreshModels?: () => void;
  modelsRefreshing?: boolean;
};

export const ModelMenu = ({
  model,
  modelOptions,
  modelsLoading,
  sort = "name",
  onSortChange,
  onModelChange,
  currentModelLabel,
  modelMenuOpen,
  menuOpen,
  onModelMenuOpenChange,
  onCloseMenu,
  onResearchSelect,
  onArtifactSelect,
  researchArmed,
  artifactArmed,
  onResearchDisarm,
  onArtifactDisarm,
  isGeneralUser,
  webSearchArmed,
  onWebSearchToggle,
  mcqArmed,
  onMcqToggle,
  thinkingArmed,
  onThinkingToggle,
  modelsTotal,
  modelsUpdatedAt,
  modelsStale,
  modelResetNotice,
  onRefreshModels,
  modelsRefreshing = false,
}: ModelMenuProps) => {
  const {
    modelQuery,
    setModelQuery,
    sortOpen,
    setSortOpen,
    researchOnly,
    imageOnly,
    filtered,
    openModelList,
    openResearchList,
    openImageList,
    closeModelList,
    selectModel,
    selectArtifact,
  } = useModelMenuList({
    modelOptions,
    menuOpen,
    modelMenuOpen,
    onModelChange,
    onModelMenuOpenChange,
    onCloseMenu,
    onResearchSelect,
    onArtifactSelect,
  });

  const updatedAgo =
    modelsStale?.updatedAgo ?? formatUpdatedAgo(modelsUpdatedAt ?? null);
  const offline = modelsStale?.offline ?? false;
  const total =
    typeof modelsTotal === "number" ? modelsTotal : modelOptions.length;
  const showFooter = modelMenuOpen;

  // Built-in (server-key) features are owner/admin only: the model picker is
  // hidden for general users without an active provider key, and the built-in
  // research/image rows are hidden for general users entirely.
  const byokActive = getActiveByok() !== null;
  const showModelRow = !isGeneralUser || byokActive;
  const showBuiltinFeatures = !isGeneralUser;

  if (!menuOpen) return null;

  return (
    <div className="composer-popover">
      {!modelMenuOpen ? (
        <div className="composer-options-list">
          {showModelRow && (
            <button
              type="button"
              className="composer-option-model-btn"
              onClick={openModelList}
            >
              <div className="composer-option-label">
                <i className="bi bi-cpu composer-option-icon-accent"></i>
                <span className="composer-ellipsis">Model</span>
              </div>
              <div className="composer-option-meta">
                <span className="composer-option-current">
                  {currentModelLabel}
                </span>
                <i className="bi bi-chevron-right composer-chevron-icon"></i>
              </div>
            </button>
          )}

          {showBuiltinFeatures && (
          <button
            type="button"
            className="composer-option-btn"
            onClick={researchArmed ? onResearchDisarm : openResearchList}
            aria-pressed={researchArmed}
          >
            <i className="bi bi-compass composer-icon-blue"></i>
            <span>Deep Research</span>
            {researchArmed ? (
              <span className="composer-option-badge">On — tap to off</span>
            ) : null}
          </button>
          )}
          <button
            type="button"
            className="composer-option-btn"
            onClick={artifactArmed ? onArtifactDisarm : selectArtifact}
            aria-pressed={artifactArmed}
            title="Generate an interactive artifact preview"
          >
            <i className="bi bi-window-stack composer-icon-orange"></i>
            <span>Artifact / Simulation</span>
            {artifactArmed ? (
              <span className="composer-option-badge">On — tap to off</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            aria-pressed={webSearchArmed === true}
            onClick={() => {
              onWebSearchToggle?.();
              if (!webSearchArmed) onCloseMenu();
            }}
          >
            <i className={`bi ${webSearchArmed ? "bi-globe-americas" : "bi-globe"} composer-icon-green`}></i>
            <span>Web Search</span>
            {webSearchArmed ? (
              <span className="composer-option-badge">On</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            aria-pressed={mcqArmed === true}
            onClick={() => {
              onMcqToggle?.();
              if (!mcqArmed) onCloseMenu();
            }}
          >
            <i className="bi bi-patch-question composer-icon-purple"></i>
            <span>Quiz (MCQ)</span>
            {mcqArmed ? (
              <span className="composer-option-badge">On</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            aria-pressed={thinkingArmed === true}
            onClick={() => {
              onThinkingToggle?.();
              if (!thinkingArmed) onCloseMenu();
            }}
          >
            <i className={`bi ${thinkingArmed ? "bi-lightbulb-fill" : "bi-lightbulb"} composer-icon-orange`}></i>
            <span>Thinking</span>
            {thinkingArmed ? (
              <span className="composer-option-badge">On</span>
            ) : null}
          </button>
          {showBuiltinFeatures && (
          <button
            type="button"
            className="composer-option-btn"
            onClick={openImageList}
          >
            <i className="bi bi-image composer-icon-purple"></i>
            <span>Image Generation</span>
          </button>
          )}
        </div>
      ) : (
        <div className="composer-model-sublist">
          <div className="composer-subheader">
            <button
              type="button"
              onClick={closeModelList}
              className="composer-back-btn"
            >
              <i className="bi bi-chevron-left composer-chevron-icon"></i>
              <span>Back</span>
            </button>
            {onSortChange && (
              <ModelSortMenu
                sort={sort}
                sortOpen={sortOpen}
                onToggleSort={() => setSortOpen(!sortOpen)}
                onSortChange={onSortChange}
                onCloseSort={() => setSortOpen(false)}
              />
            )}
          </div>
          <ModelSearch
            value={modelQuery}
            onChange={setModelQuery}
            placeholder={
              researchOnly
                ? "Search research models..."
                : imageOnly
                  ? "Search image generation models..."
                  : "Search models..."
            }
            ariaLabel={
              researchOnly
                ? "Search research models"
                : imageOnly
                  ? "Search image generation models"
                  : "Search models"
            }
          />
          <div className="composer-model-listbox">
            {filtered.map((option) => {
              const active = option.value === model;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`composer-model-item ${
                    active
                      ? "composer-model-item-active"
                      : "composer-model-item-idle"
                  }`}
                  onClick={() => selectModel(option.value)}
                >
                  <span className="composer-model-label">{option.label}</span>
                  {active && <i className="bi bi-check composer-model-check"></i>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="composer-model-empty">
                {modelsLoading
                  ? "Loading models…"
                  : researchOnly
                    ? "No deep-research models available on your plan"
                    : imageOnly
                      ? "No image generation models found"
                      : modelQuery.trim()
                        ? "No models found"
                        : "No models available"}
              </div>
            )}
          </div>
          {showFooter && (
            <ModelMenuFooter
              total={total}
              updatedAgo={updatedAgo}
              offline={offline}
              modelResetNotice={modelResetNotice}
              onRefreshModels={onRefreshModels}
              modelsRefreshing={modelsRefreshing}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ModelMenu;
