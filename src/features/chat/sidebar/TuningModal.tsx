import { useEffect, useRef, useState } from "react";
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
  id: string;
  text: string;
  on: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  muted?: boolean;
  copied: boolean;
  onCopy: (id: string, text: string) => void;
  onView: (text: string) => void;
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

// One todo-list line: single tap toggles on/off, × deletes (own prompts),
// double-click copies the text, long-press (500ms) opens the full text.
const PromptRow = ({ id, text, on, onToggle, onDelete, muted, copied, onCopy, onView }: PromptRowProps) => {
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const startPress = () => {
    longFired.current = false;
    clearTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      longFired.current = true;
      onView(text);
    }, 500);
  };

  const handleClick = (e: { detail: number }) => {
    // Second click of a double-click must not toggle twice.
    if (e.detail > 1 || longFired.current) {
      longFired.current = false;
      return;
    }
    onToggle();
  };

  return (
    <li className={`tuning-row ${on ? "tuning-row--on" : "tuning-row--off"}`}>
      <button
        type="button"
        className="tuning-row-toggle"
        onClick={handleClick}
        onDoubleClick={() => onCopy(id, text)}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={on}
        title={on ? "Tap to disable · double-tap to copy · hold for full text" : "Tap to enable · double-tap to copy · hold for full text"}
      >
        <span className="tuning-row-check" aria-hidden="true">
          {on ? <i className="bi bi-check" /> : null}
        </span>
        <span className="tuning-row-text">{text}</span>
      </button>
      {copied ? <span className="tuning-row-tag tuning-row-tag--copied">copied</span> : muted ? <span className="tuning-row-tag">folder</span> : null}
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
};

export const TuningModal = ({ conversationId, conversationTitle, folderId, folderTitle, chatFolderId, open, onClose, onSaved }: TuningModalProps) => {
  const isFolder = !!folderId;
  const scopeId = isFolder ? folderId : conversationId;
  const scopeTitle = isFolder ? folderTitle : conversationTitle;
  const [items, setItems] = useState<TuningPromptItem[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [folderItems, setFolderItems] = useState<TuningPromptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewText, setViewText] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

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
    } else {
      const cached = readCachedTuning(scopeId);
      const list = cached?.customPrompts ?? [];
      const m = cached?.mutedFolderPromptIds ?? [];
      setItems(list);
      setMuted(m);
      // Inherited folder defaults for chats inside a folder.
      if (chatFolderId) {
        const fc = readCachedFolderTuning(chatFolderId);
        if (fc) setFolderItems(fc.customPrompts);
        else setFolderItems([]);
      } else {
        setFolderItems([]);
      }
    }
    const remote = isFolder ? fetchFolderTuning(scopeId) : fetchTuning(scopeId);
    remote
      .then((cfg) => {
        setItems(cfg.customPrompts);
        if (!isFolder) setMuted((cfg as TuningConfig).mutedFolderPromptIds ?? []);
      })
      .catch((e: unknown) => {
        const msg = (e as { error?: { message?: string }; message?: string })?.error?.message
          || (e as { message?: string })?.message
          || "Failed to load tuning";
        setError(msg);
      });
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
  const atCap = items.length >= MAX_TUNING_PROMPTS;

  const addDraft = () => {
    const text = draft.trim();
    if (!text || atCap || !scopeId) return;
    const next = [...items, { id: makeTuningId(), text: text.slice(0, TUNING_MAX_LENGTH), enabled: true }];
    setItems(next);
    setDraft("");
    void persist(next, muted);
  };

  const toggleItem = (id: string) => {
    if (!scopeId) return;
    const next = items.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    setItems(next);
    void persist(next, muted);
  };
  const deleteItem = (id: string) => {
    if (!scopeId) return;
    const next = items.filter((p) => p.id !== id);
    setItems(next);
    void persist(next, muted);
  };
  const toggleMuted = (id: string) => {
    if (!scopeId) return;
    const next = muted.includes(id) ? muted.filter((m) => m !== id) : [...muted, id];
    setMuted(next);
    void persist(items, next);
  };

  const handleCopy = async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopiedId(id);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => {
        copyTimer.current = null;
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1200);
    }
  };

  // Auto-save: every add / tap-toggle / delete persists immediately —
  // no Save button needed. Failures surface in the error box; the row
  // state stays so retrying the same tap saves again.
  const persist = async (nextItems: TuningPromptItem[], nextMuted: string[]) => {
    if (!scopeId) return;
    setSaving(true);
    setError(null);
    try {
      const saved = isFolder
        ? await saveFolderTuning(scopeId, { customPrompts: nextItems })
        : await saveTuning(scopeId, { customPrompts: nextItems, mutedFolderPromptIds: nextMuted });
      if (isFolder) writeCachedFolderTuning(scopeId, saved);
      else writeCachedTuning(scopeId, saved as TuningConfig);
      onSaved?.(saved as TuningConfig);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string }; message?: string })?.error?.message
        || (e as { message?: string })?.message
        || "Failed to save — tap again to retry";
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
        {error ? <div className="tuning-error" role="alert">{error}</div> : null}
        <div className="tuning-body">
          <div className="tuning-add">
            <div className="tuning-add-wrap">
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
              <button
                type="button"
                className="tuning-add-btn"
                onClick={addDraft}
                disabled={!draft.trim() || atCap}
                aria-label="Add prompt"
                title="Add prompt"
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
                <span className="tuning-add-label">Add</span>
              </button>
            </div>
          </div>
          {!isFolder && folderItems.length > 0 ? (
            <>
              <ul className="tuning-list">
                {folderItems.map((f) => {
                  const on = f.enabled && !muted.includes(f.id);
                    return (
                    <PromptRow
                      key={f.id}
                      id={f.id}
                      text={f.text}
                      on={on}
                      muted
                      copied={copiedId === f.id}
                      onCopy={handleCopy}
                      onView={setViewText}
                      onToggle={() => toggleMuted(f.id)}
                    />
                  );
                })}
              </ul>
            </>
          ) : null}
          {items.length > 0 ? (
            <ul className="tuning-list">
              {items.map((p) => (
                <PromptRow
                  key={p.id}
                  id={p.id}
                  text={p.text}
                  on={p.enabled}
                  copied={copiedId === p.id}
                  onCopy={handleCopy}
                  onView={setViewText}
                  onToggle={() => toggleItem(p.id)}
                  onDelete={() => deleteItem(p.id)}
                />
              ))}
            </ul>
          ) : null}
        </div>
        <div className="tuning-footer">
          {saving ? <span className="tuning-hint">Saving…</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Close</Button>
        </div>
      </div>
      {viewText !== null ? (
        <div className="tuning-view" role="dialog" aria-modal="true" aria-label="Full prompt text">
          <div className="tuning-backdrop" onClick={() => setViewText(null)} aria-hidden="true" />
          <div className="tuning-view-card">
            <div className="tuning-view-text">{viewText}</div>
            <div className="tuning-view-actions">
              <Button
                variant="ghost"
                onClick={async () => {
                  await copyText(viewText);
                  setViewText(null);
                }}
              >
                Copy
              </Button>
              <Button onClick={() => setViewText(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
