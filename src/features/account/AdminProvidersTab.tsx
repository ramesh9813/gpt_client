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
  baseUrl: "",
  kind: "openai" as "openai" | "gemini" | "anthropic",
};

// One input does it all: derive the provider id + display name from the
// base URL's hostname. https://aigpt.com/api/v1 → id "aigpt", name "aigpt".
// Subdomain noise (www/api) and ports are stripped; anything unusable
// falls back to "custom-provider" so saving never blocks on parsing.
const deriveProviderIdentity = (rawUrl: string): { id: string; name: string } => {
  const fallback = { id: "custom-provider", name: "custom-provider" };
  let host = "";
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return fallback;
  }
  if (!host) return fallback;
  const labels = host.split(".").filter(Boolean);
  const NOISE = new Set(["www", "www2", "api", "api2", "apis", "gateway", "v1", "v2"]);
  while (labels.length > 1 && NOISE.has(labels[0])) labels.shift();
  // Prefer the registrable part: last two labels (aigpt.com → aigpt),
  // single-label hosts (localhost, IPs) stay whole.
  const core = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  const slug = core
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  if (!/^[a-z0-9][a-z0-9_-]{1,30}$/.test(slug)) return fallback;
  return { id: slug, name: slug };
};

const isHttpUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

// Admin/owner-only: add or edit BYOK providers (more provider). Every row
// here becomes a provider every user can immediately use with their own API
// key — users paste the key in Settings → AI provider and chat on it.
export const AdminProvidersTab = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{ ok: boolean; message: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => apiFetch<ApiResponse<{ providers: ProviderRow[] }>>("/api/providers/admin"),
    staleTime: 10_000,
  });

  const providers = data?.data?.providers ?? [];

  // Live preview of what the single URL input will save as.
  const derived = deriveProviderIdentity(form.baseUrl);
  const urlValid = isHttpUrl(form.baseUrl);

  // Verify on click: URL shape first, then a live reachability probe of
  // <baseUrl>/models. Any HTTP answer (even 401/404) means the endpoint is
  // alive; a network throw usually means unreachable or browser CORS — the
  // provider can still be saved, chat-time calls go server-side.
  const verify = async () => {
    if (!urlValid) {
      setVerifyState({ ok: false, message: "Enter a valid http(s) base URL first." });
      return;
    }
    setVerifying(true);
    setVerifyState(null);
    try {
      const base = form.baseUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(8000) });
      setVerifyState({
        ok: true,
        message:
          res.status === 401 || res.status === 403
            ? `Reachable — it asks for a key (HTTP ${res.status}), which users paste at chat time. Will save as "${derived.name}" (${derived.id}).`
            : `Reachable (HTTP ${res.status}). Will save as "${derived.name}" (${derived.id}).`,
      });
    } catch {
      setVerifyState({
        ok: false,
        message: `Could not reach it from this browser (offline or CORS-blocked) — will still save as "${derived.name}" (${derived.id}).`,
      });
    } finally {
      setVerifying(false);
    }
  };

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: derived.name,
        baseUrl: form.baseUrl.trim().replace(/\/+$/, ""),
        kind: form.kind,
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
        body: JSON.stringify({ id: derived.id, ...payload }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      void queryClient.invalidateQueries({ queryKey: ["providers-public"] });
      setNotice(editId ? "Provider updated." : "Provider added — available to all users now.");
      setEditId(null);
      setForm(emptyForm);
      setVerifyState(null);
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
      baseUrl: row.baseUrl,
      kind: (row.kind as any) || "openai",
    });
    setNotice(null);
    setVerifyState(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">More providers</h2>
      <p className="account-card-desc">
        Paste one base URL — the provider id and name are set from it
        automatically (https://aigpt.com/api/v1 → aigpt), OpenAI-compatible
        unless you pick otherwise. Once saved, every user pastes their own
        API key for it in Settings → AI provider and can immediately chat.
        Only admins and owners can manage providers.
      </p>

      <div className="account-card" style={{ marginTop: 16 }}>
        <h3 className="account-card-title">{editId ? `Edit ${editId}` : "Add a provider"}</h3>
        <div className="account-fields">
          <div>
            <label className="account-field-label" htmlFor="prov-url">Base URL</label>
            <Input
              id="prov-url"
              value={form.baseUrl}
              onChange={(e) => {
                setForm((s) => ({ ...s, baseUrl: e.target.value }));
                setVerifyState(null);
              }}
              placeholder="https://aigpt.com/api/v1"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="account-check-hint">
              {urlValid
                ? `Will save as "${derived.name}" (${derived.id}). No key asked here — users bring their own.`
                : "Must be a valid https URL. Shown to users only as transport, never logged."}
            </span>
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="outline" onClick={() => void verify()} disabled={verifying || !urlValid}>
              {verifying ? "Verifying..." : "Verify"}
            </Button>
            <Button type="button" onClick={() => upsert.mutate()} disabled={upsert.isPending || !urlValid}>
              {upsert.isPending ? "Saving..." : editId ? "Save changes" : "Add provider"}
            </Button>
            {editId ? (
              <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(emptyForm); setNotice(null); setVerifyState(null); }}>
                Cancel
              </Button>
            ) : null}
          </div>
          {verifyState ? (
            <span className={`byok-key-status ${verifyState.ok ? "byok-key-status--ok" : "byok-key-status--bad"}`}>
              {verifyState.message}
            </span>
          ) : null}
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
