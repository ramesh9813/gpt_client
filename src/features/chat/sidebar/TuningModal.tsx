import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import "./TuningModal.css";
import { MAX_TUNING_PROMPTS, TUNING_MAX_LENGTH, fetchTuning, makeTuningId, readCachedTuning, saveTuning, writeCachedTuning, type TuningConfig, type TuningPromptItem } from "../chatTuning";
import { fetchFolderTuning, readCachedFolderTuning, saveFolderTuning, writeCachedFolderTuning } from "../folderTuning";

export interface TuningModalProps {
  conversationId: string | null;
  conversationTitle?: string;
  // Folder mode: when folderId is set, the modal edits the folder-level
  // prompts inherited by every chat inside (chat props ignored).
  folderId?: string | null;
  folderTitle?: string;
  // Chat mode: the chat's folder (if any) — its prompts show up as defaults.
  chatFolderId?: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (cfg: TuningConfig) => void;
}

type PromptRowProps = {
  text: string;
  on: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  muted?: boolean;
};

// One todo-list line: single tap toggles on/off, × deletes (own prompts).
const PromptRow = ({ text, on, onToggle, onDelete, muted }: PromptRowProps) => (
  <li className={`tuning-row ${on ? "tuning-row--on" : "tuning-row--off"}`}>
    <button
      type="button"
      className="tuning-row-toggle"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "Tap to disable" : "Tap to enable"}
    >
      <span className="tuning-row-check" aria-hidden="true">
        {on ? <i className="bi bi-check" /> : null}
      </span>
      <span className="tuning-row-text">{text}</span>
    </button>
    {muted ? <span className="tuning-row-tag">folder</span> : null}
    {onDelete ? (
      <button
        type="button"
        className="tuning-row-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete prompt: ${text}`}
        title="Delete"
      >
        ×
      </button>
    ) : null}
  </li>
);

export const TuningModal = ({ conversationId, conversationTitle, folderId, folderTitle, chatFolderId, open, onClose, onSaved }: TuningModalProps) => {
  const isFolder = !!folderId;
  const scopeId = isFolder ? folderId : conversationId;
  const scopeTitle = isFolder ? folderTitle : conversationTitle;
  const [items, setItems] = useState<TuningPromptItem[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [folderItems, setFolderItems] = useState<TuningPromptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [initial, setInitial] = useState<{ list: TuningPromptItem[]; m: string[] }>({ list: [], m: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy load once per open (cache-first paint, then background refresh).
  useEffect(() => {
    if (!open || !scopeId) return;
    setError(null);
    setDraft("");
    if (isFolder) {
      const cached = readCachedFolderTuning(scopeId);
      const list = cached?.customPrompts ?? [];
      setItems(list);
      setFolderItems([]);
      setMuted([]);
      setInitial({ list, m: [] });
    } else {
      const cached = readCachedTuning(scopeId);
      const list = cached?.customPrompts ?? [];
      const m = cached?.mutedFolderPromptIds ?? [];
      setItems(list);
      setMuted(m);
      setInitial({ list, m: [...m].sort() });
      // Inherited folder defaults for chats inside a folder.
      if (chatFolderId) {
        const fc = readCachedFolderTuning(chatFolderId);
        if (fc) setFolderItems(fc.customPrompts);
        else setFolderItems([]);
      } else {
        setFolderItems([]);
      }
    }
    setLoading(true);
    const remote = isFolder ? fetchFolderTuning(scopeId) : fetchTuning(scopeId);
    remote
      .then((cfg) => {
        setItems(cfg.customPrompts);
        const m = !isFolder ? ((cfg as TuningConfig).mutedFolderPromptIds ?? []) : [];
        if (!isFolder) setMuted(m);
        setInitial({ list: cfg.customPrompts, m: [...m].sort() });
      })
      .catch((e: unknown) => {
        const msg = (e as { error?: { message?: string }; message?: string })?.error?.message
          || (e as { message?: string })?.message
          || "Failed to load tuning";
        setError(msg);
      })
      .finally(() => setLoading(false));
    if (!isFolder && chatFolderId) {
      fetchFolderTuning(chatFolderId)
        .then((fc) => setFolderItems(fc.customPrompts))
        .catch(() => {
          // inherited section is best-effort — own prompts still work
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeId]);

  if (!open || !scopeId) return null;

  const activeCount = items.filter((i) => i.enabled).length;
  const inheritedActive = folderItems.filter((f) => f.enabled && !muted.includes(f.id)).length;
  const dirty = JSON.stringify({ list: items, m: [...muted].sort() }) !==
    JSON.stringify({ list: initial.list, m: [...initial.m].sort() });
  const atCap = items.length >= MAX_TUNING_PROMPTS;

  const addDraft = () => {
    const text = draft.trim();
    if (!text || atCap) return;
    setItems((prev) => [...prev, { id: makeTuningId(), text: text.slice(0, TUNING_MAX_LENGTH), enabled: true }]);
    setDraft("");
  };

  const toggleItem = (id: string) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  const deleteItem = (id: string) =>
    setItems((prev) => prev.filter((p) => p.id !== id));
  const toggleMuted = (id: string) =>
    setMuted((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!scopeId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = isFolder
        ? await saveFolderTuning(scopeId, { customPrompts: items })
        : await saveTuning(scopeId, { customPrompts: items, mutedFolderPromptIds: muted });
      if (isFolder) writeCachedFolderTuning(scopeId, saved);
      else writeCachedTuning(scopeId, saved as TuningConfig);
      onSaved?.(saved as TuningConfig);
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

  const totalActive = activeCount + (!isFolder ? inheritedActive : 0);

  return (
    <div className="tuning-overlay" role="dialog" aria-modal="true" aria-label={isFolder ? "Folder Tuning" : "Chat Tuning"}>
      <div className="tuning-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tuning-panel">
        <div className="tuning-header">
          <h3 className="tuning-title">{isFolder ? `Folder Tuning${scopeTitle ? ` — ${scopeTitle}` : ""}` : "Chat Tuning"}</h3>
          <div className="tuning-header-actions">
            <span className="tuning-count" title={`${totalActive} prompt${totalActive === 1 ? "" : "s"} active`}>
              {totalActive} on
            </span>
            <button type="button" className="tuning-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        {conversationTitle && !isFolder ? <div className="tuning-subtitle">{conversationTitle}</div> : null}
        {loading ? <div className="tuning-hint">Loading…</div> : null}
        {error ? <div className="tuning-error" role="alert">{error}</div> : null}
        <div className="tuning-body">
          {!isFolder && folderItems.length > 0 ? (
            <>
              <span className="tuning-label">From folder — on by default, tap to disable</span>
              <ul className="tuning-list">
                {folderItems.map((f) => {
                  const on = f.enabled && !muted.includes(f.id);
                  return (
                    <PromptRow
                      key={f.id}
                      text={f.text}
                      on={on}
                      muted
                      onToggle={() => toggleMuted(f.id)}
                    />
                  );
                })}
              </ul>
            </>
          ) : null}
          <span className="tuning-label">{isFolder ? "Folder prompts — tap to disable, × to delete" : "This chat — tap to disable, × to delete"}</span>
          {isFolder ? (
            <div className="tuning-hint">Applies to every chat inside this folder.</div>
          ) : null}
          {items.length > 0 ? (
            <ul className="tuning-list">
              {items.map((p) => (
                <PromptRow
                  key={p.id}
                  text={p.text}
                  on={p.enabled}
                  onToggle={() => toggleItem(p.id)}
                  onDelete={() => deleteItem(p.id)}
                />
              ))}
            </ul>
          ) : (
            <div className="tuning-hint">No prompts yet — add one below.</div>
          )}
          <div className="tuning-add">
            <Input
              className="tuning-add-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder={atCap ? `Limit reached (${MAX_TUNING_PROMPTS})` : "Type a prompt, Enter to add…"}
              aria-label="New custom prompt"
              spellCheck={false}
              autoComplete="off"
              maxLength={TUNING_MAX_LENGTH}
              disabled={atCap}
            />
            <Button onClick={addDraft} disabled={!draft.trim() || atCap}>Add</Button>
          </div>
        </div>
        <div className="tuning-footer">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !dirty || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
