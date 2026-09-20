import { useEffect, useMemo, useState } from "react";
import { Input } from "../../../components/Input";
import { ModelMenuFooter } from "./ModelMenuFooter";
import { ModelSortMenu } from "./ModelSortMenu";
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
  const [modelQuery, setModelQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  // Research mode: list only deep-research-capable models.
  const [researchOnly, setResearchOnly] = useState(false);
  const [imageOnly, setImageOnly] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setResearchOnly(false);
      setImageOnly(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!modelMenuOpen) {
      setModelQuery("");
      setSortOpen(false);
      setResearchOnly(false);
      setImageOnly(false);
    }
  }, [modelMenuOpen]);

  const researchOptions = useMemo(
    () => modelOptions.filter((option) => option.supportsResearch),
    [modelOptions]
  );

  const imageOptions = useMemo(
    () => modelOptions.filter((option) => option.supportsImage),
    [modelOptions]
  );

  const visibleOptions = researchOnly
    ? researchOptions
    : imageOnly
    ? imageOptions
    : modelOptions;

  const filtered = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return visibleOptions;
    return visibleOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
    );
  }, [visibleOptions, modelQuery]);

  const updatedAgo =
    modelsStale?.updatedAgo ?? formatUpdatedAgo(modelsUpdatedAt ?? null);
  const offline = modelsStale?.offline ?? false;
  const total =
    typeof modelsTotal === "number" ? modelsTotal : modelOptions.length;
  const showFooter = modelMenuOpen;

  if (!menuOpen) return null;

  const openModelList = () => {
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(false);
    onModelMenuOpenChange(true);
  };

  const openResearchList = () => {
    setModelQuery("");
    setResearchOnly(true);
    setImageOnly(false);
    onModelMenuOpenChange(true);
  };

  const openImageList = () => {
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(true);
    onModelMenuOpenChange(true);
  };

  const closeModelList = () => {
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(false);
    onModelMenuOpenChange(false);
  };

  const selectModel = (value: string) => {
    onModelChange(value);
    if (researchOnly) onResearchSelect?.();
    setModelQuery("");
    setResearchOnly(false);
    setImageOnly(false);
    onModelMenuOpenChange(false);
    onCloseMenu();
  };

  const selectArtifact = () => {
    // Arm artifact mode only — never auto-send. The user reviews/edits the
    // prompt, then hits Send (mirrors researchArmed one-shot pattern).
    onArtifactSelect?.();
    onCloseMenu();
  };

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
          <div className="composer-query-wrap">
            <div className="composer-query-box">
              <i className="bi bi-search composer-query-icon" aria-hidden="true"></i>
              <Input
                autoFocus
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={
                  researchOnly
                    ? "Search research models..."
                    : imageOnly
                      ? "Search image generation models..."
                      : "Search models..."
                }
                aria-label={
                  researchOnly
                    ? "Search research models"
                    : imageOnly
                      ? "Search image generation models"
                      : "Search models"
                }
                className="composer-query-input"
              />
              {modelQuery && (
                <button
                  type="button"
                  onClick={() => setModelQuery("")}
                  aria-label="Clear model search"
                  title="Clear"
                  className="composer-query-clear"
                >
                  <i className="bi bi-x composer-clear-icon" aria-hidden="true"></i>
                </button>
              )}
            </div>
          </div>
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
