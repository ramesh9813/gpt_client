import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiFetch, type ApiResponse } from "../../lib/api";

type ProviderRow = {
  id: string;
  name: string;
  baseUrl: string;
  kind: string;
  keyHint: string | null;
  keyPattern: string | null;
  keylessModels: boolean;
  models: string[];
  streamUsage: boolean;
  allModelsFree: boolean;
  isActive: boolean;
};

const emptyForm = {
  id: "",
  name: "",
  baseUrl: "",
  kind: "openai" as "openai" | "gemini" | "anthropic",
  keyHint: "",
  keyPattern: "",
  keylessModels: false,
  modelsText: "",
  streamUsage: false,
  allModelsFree: false,
  isActive: true,
};

const parseModelsText = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);

// Admin/owner-only: add or edit BYOK providers (more provider). Every row
// here becomes a provider every user can immediately use with their own API
// key — users paste the key in Settings → AI provider and chat on it.
export const AdminProvidersTab = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => apiFetch<ApiResponse<{ providers: ProviderRow[] }>>("/api/providers/admin"),
    staleTime: 10_000,
  });

  const providers = data?.data?.providers ?? [];

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        kind: form.kind,
        keyHint: form.keyHint.trim() || undefined,
        keyPattern: form.keyPattern.trim() || undefined,
        keylessModels: form.keylessModels,
        models: parseModelsText(form.modelsText),
        streamUsage: form.streamUsage,
        allModelsFree: form.allModelsFree,
        isActive: form.isActive,
      };
      if (editId) {
        return apiFetch(`/api/providers/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id.trim().toLowerCase(), ...payload }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      void queryClient.invalidateQueries({ queryKey: ["providers-public"] });
      setNotice(editId ? "Provider updated." : "Provider added — available to all users now.");
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => {
      setNotice(e?.error?.message || e?.message || "Could not save provider.");
    },
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      void queryClient.invalidateQueries({ queryKey: ["providers-public"] });
      setNotice("Provider removed.");
    },
    onError: (e: any) => setNotice(e?.error?.message || "Could not remove provider."),
  });

  const startEdit = (row: ProviderRow) => {
    setEditId(row.id);
    setForm({
      id: row.id,
      name: row.name,
      baseUrl: row.baseUrl,
      kind: (row.kind as any) || "openai",
      keyHint: row.keyHint ?? "",
      keyPattern: row.keyPattern ?? "",
      keylessModels: row.keylessModels,
      modelsText: (row.models ?? []).join(", "),
      streamUsage: row.streamUsage,
      allModelsFree: row.allModelsFree,
      isActive: row.isActive,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">More providers</h2>
      <p className="account-card-desc">
        Add any OpenAI-compatible provider (provider id + base URL). Once saved,
        it appears for every user in Settings → AI provider — they paste their
        own API key for that provider and can immediately chat with it. Only
        admins and owners can manage providers.
      </p>

      <div className="account-card" style={{ marginTop: 16 }}>
        <h3 className="account-card-title">{editId ? `Edit ${editId}` : "Add a provider"}</h3>
        <div className="account-fields">
          <div>
            <label className="account-field-label" htmlFor="prov-id">
              Provider id <span className="account-font-size-value">lowercase slug, e.g. my-provider</span>
            </label>
            <Input
              id="prov-id"
              value={form.id}
              disabled={Boolean(editId)}
              onChange={(e) => setForm((s) => ({ ...s, id: e.target.value.toLowerCase() }))}
              placeholder="my-provider"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-name">Display name</label>
            <Input id="prov-name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="My Provider" />
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-url">Base URL</label>
            <Input
              id="prov-url"
              value={form.baseUrl}
              onChange={(e) => setForm((s) => ({ ...s, baseUrl: e.target.value }))}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="account-check-hint">Must be a valid https URL. Shown to users only as transport, never logged.</span>
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-kind">API kind</label>
            <select
              id="prov-kind"
              className="account-select"
              value={form.kind}
              onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as any }))}
            >
              <option value="openai">OpenAI-compatible (/v1)</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-hint">Key hint</label>
            <Input id="prov-hint" value={form.keyHint} onChange={(e) => setForm((s) => ({ ...s, keyHint: e.target.value }))} placeholder="sk-... or your API key" />
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-pattern">Key pattern (RegExp, optional)</label>
            <Input
              id="prov-pattern"
              value={form.keyPattern}
              onChange={(e) => setForm((s) => ({ ...s, keyPattern: e.target.value }))}
              placeholder="^sk-[A-Za-z0-9]{20,}$  (leave blank for permissive)"
              spellCheck={false}
            />
            <span className="account-check-hint">Instant format check before any network call. Blank = accept any non-empty key and let Verify hit /v1/models.</span>
          </div>
          <div>
            <label className="account-field-label" htmlFor="prov-models">Fallback models (comma or newline separated, optional)</label>
            <textarea
              id="prov-models"
              className="account-select"
              style={{ minHeight: 72, padding: 10, resize: "vertical" }}
              value={form.modelsText}
              onChange={(e) => setForm((s) => ({ ...s, modelsText: e.target.value }))}
              placeholder="gpt-4o, gpt-4o-mini"
            />
            <span className="account-check-hint">Live /v1/models always wins when reachable. This keeps the dropdown usable offline.</span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className="account-check-row" style={{ flex: "1 1 160px" }}>
              <input type="checkbox" checked={form.keylessModels} onChange={(e) => setForm((s) => ({ ...s, keylessModels: e.target.checked }))} />
              <span className="account-check-hint" style={{ margin: 0 }}>List models without a key</span>
            </label>
            <label className="account-check-row" style={{ flex: "1 1 160px" }}>
              <input type="checkbox" checked={form.streamUsage} onChange={(e) => setForm((s) => ({ ...s, streamUsage: e.target.checked }))} />
              <span className="account-check-hint" style={{ margin: 0 }}>Send stream_options usage</span>
            </label>
            <label className="account-check-row" style={{ flex: "1 1 160px" }}>
              <input type="checkbox" checked={form.allModelsFree} onChange={(e) => setForm((s) => ({ ...s, allModelsFree: e.target.checked }))} />
              <span className="account-check-hint" style={{ margin: 0 }}>All models free</span>
            </label>
            <label className="account-check-row" style={{ flex: "1 1 160px" }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} />
              <span className="account-check-hint" style={{ margin: 0 }}>Active (visible to users)</span>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name.trim() || !form.baseUrl.trim() || (!editId && !form.id.trim())}>
              {upsert.isPending ? "Saving..." : editId ? "Save changes" : "Add provider"}
            </Button>
            {editId ? (
              <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(emptyForm); setNotice(null); }}>
                Cancel
              </Button>
            ) : null}
          </div>
          {notice ? (
            <span className={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("already") ? "account-check-hint" : "byok-key-status byok-key-status--ok"}>
              {notice}
            </span>
          ) : null}
          {upsert.isError || del.isError ? null : null}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 className="account-card-title">Custom providers</h3>
        {isLoading ? (
          <span className="account-check-hint">Loading…</span>
        ) : isError ? (
          <span className="account-check-hint">Could not load providers.</span>
        ) : providers.length === 0 ? (
          <span className="account-check-hint">No custom providers yet. Add one above — it becomes available to all users immediately.</span>
        ) : (
          <div className="admin-user-list">
            {providers.map((p) => (
              <div key={p.id} className="account-card admin-user-row" style={{ alignItems: "flex-start" }}>
                <div className="admin-user-info" style={{ minWidth: 0 }}>
                  <div className="account-profile-name">
                    {p.name} <span className="account-font-size-value">({p.id}) {p.isActive ? "" : "· inactive"}</span>
                  </div>
                  <div className="account-profile-email" style={{ wordBreak: "break-all" }}>{p.baseUrl} · {p.kind}</div>
                  <div className="account-font-size-value" style={{ wordBreak: "break-all" }}>
                    hint: {p.keyHint || "—"} {p.keyPattern ? `· /${p.keyPattern}/` : ""} {p.models?.length ? `· ${p.models.length} fallback` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button type="button" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                  <Button type="button" variant="outline" onClick={() => { if (confirm(`Remove provider "${p.id}"? Users will lose it until re-added.`)) del.mutate(p.id); }} disabled={del.isPending}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProvidersTab;
