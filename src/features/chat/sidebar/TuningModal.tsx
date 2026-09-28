import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Textarea } from "../../../components/Textarea";
import "./TuningModal.css";
import { TUNING_MAX_LENGTH, fetchTuning, readCachedTuning, saveTuning, writeCachedTuning, type TuningConfig } from "../chatTuning";

export interface TuningModalProps {
  conversationId: string | null;
  conversationTitle?: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (cfg: TuningConfig) => void;
}

export const TuningModal = ({ conversationId, conversationTitle, open, onClose, onSaved }: TuningModalProps) => {
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [initialCfg, setInitialCfg] = useState<TuningConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load once per open (cache-first paint, then background refresh).
  useEffect(() => {
    if (!open || !conversationId) return;
    setError(null);
    const cached = readCachedTuning(conversationId);
    if (cached) {
      setEnabled(cached.customPromptEnabled);
      setPrompt(cached.customPrompt ?? "");
      setInitialCfg(cached);
    } else {
      setEnabled(false);
      setPrompt("");
      setInitialCfg(null);
    }
    setLoading(true);
    fetchTuning(conversationId)
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
  }, [open, conversationId]);

  if (!open || !conversationId) return null;

  const charCount = prompt.length;
  const over = charCount > TUNING_MAX_LENGTH;
  const dirty = !initialCfg || initialCfg.customPrompt !== prompt || initialCfg.customPromptEnabled !== enabled;

  const handleSave = async () => {
    if (!conversationId) return;
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
      const saved = await saveTuning(conversationId, cfg);
      writeCachedTuning(conversationId, saved);
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
    <div className="tuning-overlay" role="dialog" aria-modal="true" aria-label="Chat Tuning">
      <div className="tuning-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tuning-panel">
        <div className="tuning-header">
          <h3 className="tuning-title">Chat Tuning</h3>
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
