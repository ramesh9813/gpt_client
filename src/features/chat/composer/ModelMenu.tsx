import { useEffect, useMemo, useRef, useState } from "react";
import { ModelSearch } from "./ModelSearch";
import { ModelMenuFooter } from "./ModelMenuFooter";
import { ModelSortMenu } from "./ModelSortMenu";
import { ModelProviderMenu } from "./ModelProviderMenu";
import { useModelMenuList } from "./useModelMenuList";
import { formatUpdatedAgo } from "../utils/formatUpdatedAgo";
import {
  fetchByokModels,
  getActiveByok,
  getByokConfig,
  getByokProvider,
  saveByokConfig,
  savedByokProviders,
} from "../../../lib/byok";
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
  // Hierarchical picker: provider id driving this chat (null = built-in),
  // plus provider-scoped activation (switches provider AND model together).
  activeProviderId?: string | null;
  onProviderModelChange?: (providerId: string, model: string) => void;
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
  trimArmed?: boolean;
  onTrimToggle?: () => void;
  onFilePick?: () => void;
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
  trimArmed,
  onTrimToggle,
  onFilePick,
  activeProviderId,
  onProviderModelChange,
  modelsTotal,
  modelsUpdatedAt,
  modelsStale,
  modelResetNotice,
  onRefreshModels,
  modelsRefreshing = false,
}: ModelMenuProps) => {
  // Hierarchical picker: keyed providers only. Picking one swaps the card to
  // that provider's models (cached first, live-refreshed); picking a model
  // activates provider+model together for ongoing chats.
  const keyedProviders = useMemo(() => {
    const saved = savedByokProviders();
    return saved.map(({ id }) => ({
      id,
      name: getByokProvider(id)?.name ?? id,
    }));
  }, [menuOpen, modelMenuOpen]);
  const [providerPick, setProviderPick] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [providerLoading, setProviderLoading] = useState(false);
  // Why a picked provider shows no models (bad key, unreachable /models,
  // unknown provider) — surfaced instead of a dead end, with a manual
  // model-id entry so the provider's models stay selectable regardless.
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [manualModel, setManualModel] = useState("");
  const providerFetchSeq = useRef(0);

  useEffect(() => {
    if (!menuOpen && !modelMenuOpen) {
      setProviderPick("");
      setProviderOpen(false);
      setProviderModels([]);
      setProviderLoading(false);
      setProviderNote(null);
      setManualModel("");
    }
  }, [menuOpen, modelMenuOpen]);

  const activePick = providerPick || activeProviderId || "";
  // Explicit pick only: a fallback to the already-active provider must keep
  // showing the live context list (modelOptions) — providerModels is empty
  // until a pick loads it, which blanked the whole card on open.
  const explicitPick =
    providerPick && keyedProviders.some((p) => p.id === providerPick)
      ? keyedProviders.find((p) => p.id === providerPick)!
      : null;

  const loadProviderModels = (pid: string) => {
    const cfg = getByokConfig();
    const live = cfg?.models?.[pid];
    const base =
      live && live.length > 0
        ? live
        : (getByokProvider(pid)?.models ?? []);
    setProviderModels([...base].sort((a, b) => a.localeCompare(b)));
    const key = cfg?.apiKeys?.[pid] ?? (cfg?.provider === pid ? cfg.apiKey : "");
    if (!key) return;
    const seq = ++providerFetchSeq.current;
    setProviderLoading(true);
    void fetchByokModels(pid, key)
      .then(({ models: list, freeIds, message }) => {
        if (providerFetchSeq.current !== seq) return;
        setProviderLoading(false);
        if (list.length > 0) {
          setProviderNote(null);
          const latest = getByokConfig();
          saveByokConfig({
            ...(latest ?? { provider: null, model: "", apiKey: "" }),
            models: { ...(latest?.models ?? {}), [pid]: list },
            freeModels: { ...(latest?.freeModels ?? {}), [pid]: freeIds },
          });
          setProviderModels([...list].sort((a, b) => a.localeCompare(b)));
        } else {
          setProviderNote(
            message ?? "No models returned — check the key, or type the model id below."
          );
        }
      })
      .catch(() => {
        if (providerFetchSeq.current !== seq) return;
        setProviderLoading(false);
        setProviderNote("Could not reach the provider — check connection, or type the model id below.");
      });
  };

  const handleProviderSelect = (pid: string) => {
    setProviderPick(pid);
    setProviderOpen(false);
    setProviderNote(null);
    setManualModel("");
    if (pid) loadProviderModels(pid);
    else {
      setProviderModels([]);
      setProviderLoading(false);
    }
  };

  const providerDisplayOptions: ModelOption[] = useMemo(() => {
    if (!explicitPick) return modelOptions;
    return providerModels.map((id) => ({ label: id, value: id }));
  }, [explicitPick, providerModels, modelOptions]);

  const handleSelectModel = (value: string) => {
    if (explicitPick && explicitPick.id !== (activeProviderId ?? "") && onProviderModelChange) {
      onProviderModelChange(explicitPick.id, value);
      setProviderPick("");
      setProviderModels([]);
      setProviderNote(null);
      setManualModel("");
    } else {
      onModelChange(value);
    }
  };

  // Manual fallback: the provider's models stay selectable by id even when
  // its /models endpoint is unreachable — activates the same way.
  const useManualModel = () => {
    const id = manualModel.trim();
    if (!explicitPick || !id) return;
    if (explicitPick.id !== (activeProviderId ?? "") && onProviderModelChange) {
      onProviderModelChange(explicitPick.id, id);
      setProviderPick("");
      setProviderModels([]);
      setProviderNote(null);
      setManualModel("");
    } else {
      onModelChange(id);
    }
    setModelQuery("");
    onModelMenuOpenChange(false);
    onCloseMenu();
  };

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
    modelOptions: providerDisplayOptions,
    menuOpen,
    modelMenuOpen,
    onModelChange: handleSelectModel,
    onModelMenuOpenChange,
    onCloseMenu,
    onResearchSelect,
    onArtifactSelect,
  });
  const showProviderDropdown = keyedProviders.length > 0;

  const updatedAgo =
    modelsStale?.updatedAgo ?? formatUpdatedAgo(modelsUpdatedAt ?? null);
  const offline = modelsStale?.offline ?? false;
  const total = explicitPick
    ? providerDisplayOptions.length
    : typeof modelsTotal === "number"
      ? modelsTotal
      : modelOptions.length;
  const showFooter = modelMenuOpen;

  // Built-in (server-key) features are owner/admin only: the model picker is
  // hidden for general users without an active provider key, and the built-in
  // research/image rows are hidden for general users entirely.
  const byokCfg = getActiveByok();
  const byokActive = byokCfg !== null;
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
          <button
            type="button"
            className="composer-option-btn"
            aria-pressed={trimArmed === true}
            onClick={() => {
              onTrimToggle?.();
              if (!trimArmed) onCloseMenu();
            }}
          >
            <i className="bi bi-scissors composer-icon-green"></i>
            <span>Auto-trim history</span>
            {trimArmed ? (
              <span className="composer-option-badge">On</span>
            ) : null}
          </button>
          <button
            type="button"
            className="composer-option-btn"
            onClick={() => {
              onFilePick?.();
              onCloseMenu();
            }}
          >
            <i className="bi bi-file-earmark composer-icon-blue"></i>
            <span>Files</span>
            <span className="composer-option-hint">code, pdf, txt, audio</span>
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
            {showProviderDropdown && (
              <ModelProviderMenu
                providers={keyedProviders}
                value={activePick}
                allLabel="All"
                open={providerOpen}
                onToggle={() => setProviderOpen((prev) => !prev)}
                onSelect={handleProviderSelect}
                onClose={() => setProviderOpen(false)}
              />
            )}
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
                {providerLoading
                  ? "Loading models…"
                  : modelsLoading
                    ? "Loading models…"
                    : researchOnly
                      ? "No deep-research models available on your plan"
                      : imageOnly
                        ? "No image generation models found"
                        : modelQuery.trim()
                          ? "No models found"
                          : explicitPick
                            ? "No models for this provider yet"
                            : "No models available"}
              </div>
            )}
          </div>
          {explicitPick && !providerLoading && providerModels.length === 0 && (
            <div className="composer-provider-manual">
              {providerNote ? (
                <div className="composer-provider-note">{providerNote}</div>
              ) : null}
              <div className="composer-provider-manual-row">
                <input
                  className="composer-provider-input"
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      useManualModel();
                    }
                  }}
                  placeholder="Type model id…"
                  aria-label="Use a specific model id from this provider"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="composer-provider-use"
                  disabled={!manualModel.trim()}
                  onClick={useManualModel}
                >
                  Use
                </button>
              </div>
            </div>
          )}
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
