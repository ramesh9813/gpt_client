import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Textarea } from "../../../components/Textarea";
import "./TuningModal.css";
import { TUNING_MAX_LENGTH, fetchTuning, readCachedTuning, saveTuning, writeCachedTuning, type TuningConfig } from "../chatTuning";
import { fetchFolderTuning, readCachedFolderTuning, saveFolderTuning, writeCachedFolderTuning } from "../folderTuning";

export interface TuningModalProps {
  conversationId: string | null;
  conversationTitle?: string;
  // Folder mode: when folderId is set, the modal edits the folder-level
  // custom prompt inherited by every chat inside (chat props ignored).
  folderId?: string | null;
  folderTitle?: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (cfg: TuningConfig) => void;
}

export const TuningModal = ({ conversationId, conversationTitle, folderId, folderTitle, open, onClose, onSaved }: TuningModalProps) => {
  const isFolder = !!folderId;
  const scopeId = isFolder ? folderId : conversationId;
  const scopeTitle = isFolder ? folderTitle : conversationTitle;
  // Default ON: a fresh custom prompt activates on Save without an extra toggle.
  const [enabled, setEnabled] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [initialCfg, setInitialCfg] = useState<TuningConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load once per open (cache-first paint, then background refresh).
  const loadCached = (id: string) =>
    isFolder ? readCachedFolderTuning(id) : readCachedTuning(id);
  const loadRemote = (id: string) =>
    isFolder ? fetchFolderTuning(id) : fetchTuning(id);
  useEffect(() => {
    if (!open || !scopeId) return;
    setError(null);
    const cached = loadCached(scopeId);
    if (cached) {
      setEnabled(cached.customPromptEnabled);
      setPrompt(cached.customPrompt ?? "");
      setInitialCfg(cached);
    } else {
      setEnabled(true);
      setPrompt("");
      setInitialCfg(null);
    }
    setLoading(true);
    loadRemote(scopeId)
      .then((cfg) => {
        setEnabled(cfg.customPromptEnabled);
        setPrompt(cfg.customPrompt ?? "");
        setInitialCfg(cfg);
      })
      .catch((e: unknown) => {
        const msg = (e as { error?: { message?: string }; message?: string })?.error?.message
          || (e as { message?: string })?.message
          || "Failed to load tuning";
        setError(msg);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeId]);

  if (!open || !scopeId) return null;

  const charCount = prompt.length;
  const over = charCount > TUNING_MAX_LENGTH;
  const dirty = !initialCfg || initialCfg.customPrompt !== prompt || initialCfg.customPromptEnabled !== enabled;

  const handleSave = async () => {
    if (!scopeId) return;
    if (over) {
      setError(`Prompt exceeds ${TUNING_MAX_LENGTH} characters`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Server sanitises + enforces enabled=false when empty
      const cfg: TuningConfig = {
        customPrompt: prompt,
        customPromptEnabled: enabled,
      };
      const saved = isFolder
        ? await saveFolderTuning(scopeId, cfg)
        : await saveTuning(scopeId, cfg);
      if (isFolder) writeCachedFolderTuning(scopeId, saved);
      else writeCachedTuning(scopeId, saved);
      onSaved?.(saved);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string }; message?: string })?.error?.message
        || (e as { message?: string })?.message
        || "Failed to save tuning";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tuning-overlay" role="dialog" aria-modal="true" aria-label={isFolder ? "Folder Tuning" : "Chat Tuning"}>
      <div className="tuning-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tuning-panel">
        <div className="tuning-header">
          <h3 className="tuning-title">{isFolder ? `Folder Tuning${scopeTitle ? ` — ${scopeTitle}` : ""}` : "Chat Tuning"}</h3>
          <div className="tuning-header-actions">
            <label className="tuning-toggle" title={enabled ? "Tuning is ON" : "Tuning is OFF"}>
              <input
                type="checkbox"
                className="tuning-toggle-input"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label="Enable custom prompt"
              />
              <span className="tuning-toggle-track" aria-hidden="true"><span className="tuning-toggle-thumb" /></span>
              <span className="tuning-toggle-text">{enabled ? "On" : "Off"}</span>
            </label>
            <button type="button" className="tuning-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        {loading ? <div className="tuning-hint">Loading…</div> : null}
        {error ? <div className="tuning-error" role="alert">{error}</div> : null}
        <div className="tuning-body">
          <label className="tuning-label" htmlFor="tuning-prompt">Custom prompt</label>
          {isFolder ? (
            <div className="tuning-hint">Applies to every chat inside this folder.</div>
          ) : null}
          <Textarea
            id="tuning-prompt"
            className="tuning-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder=""
            rows={5}
            maxLength={TUNING_MAX_LENGTH}
            aria-describedby="tuning-counter"
          />
          <div className="tuning-meta">
            <span id="tuning-counter" className={`tuning-counter ${over ? "tuning-counter--over" : ""}`}>
              {charCount} / {TUNING_MAX_LENGTH}
            </span>
          </div>
        </div>
        <div className="tuning-footer">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || over || !dirty || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
