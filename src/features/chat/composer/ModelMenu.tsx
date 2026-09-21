import { ModelSearch } from "./ModelSearch";
import { ModelMenuFooter } from "./ModelMenuFooter";
import { ModelSortMenu } from "./ModelSortMenu";
import { useModelMenuList } from "./useModelMenuList";
import { formatUpdatedAgo } from "../utils/formatUpdatedAgo";
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

  if (!menuOpen) return null;

  return (
    <div className="composer-popover">
      {!modelMenuOpen ? (
        <div className="composer-options-list">
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

          <button
            type="button"
            className="composer-option-btn"
            onClick={openResearchList}
            aria-pressed={researchArmed}
          >
            <i className="bi bi-compass composer-icon-blue"></i>
            <span>Deep Research</span>
            {researchArmed ? (
              <span className="composer-option-badge">Armed</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            onClick={selectArtifact}
            aria-pressed={artifactArmed}
            title="Generate an interactive artifact preview"
          >
            <i className="bi bi-window-stack composer-icon-orange"></i>
            <span>Artifact / Simulation</span>
            {artifactArmed ? (
              <span className="composer-option-badge">Armed</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            onClick={onCloseMenu}
          >
            <i className="bi bi-globe composer-icon-green"></i>
            <span>Web Search</span>
          </button>
          <button
            type="button"
            className="composer-option-btn"
            onClick={openImageList}
          >
            <i className="bi bi-image composer-icon-purple"></i>
            <span>Image Generation</span>
          </button>
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
