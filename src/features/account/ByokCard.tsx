import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiFetch, type ApiResponse } from "../../lib/api";
import {
  BYOK_PROVIDERS,
  fetchByokModels,
  getByokConfig,
  getByokProvider,
  isByokKeyFormatSupported,
  saveByokConfig,
  type ServerProviderInfo,
} from "../../lib/byok";

type ValidateResult = {
  supported: boolean;
  verified: boolean;
  models: string[];
  freeIds?: string[];
  message: string;
};

type VerifyState = { ok: boolean; message: string } | null;

type MergedProvider = {
  id: string;
  name: string;
  keyHint: string;
  keyPattern: RegExp;
  modelsPublic: boolean;
  models: string[];
  source: "builtin" | "custom";
};

const toMerged = (list: ServerProviderInfo[]): MergedProvider[] =>
  list.map((p) => {
    let pat: RegExp;
    try {
      pat = p.keyPattern ? new RegExp(p.keyPattern) : /^[A-Za-z0-9][A-Za-z0-9_.-]{7,}$/;
    } catch {
      pat = /^[A-Za-z0-9][A-Za-z0-9_.-]{7,}$/;
    }
    return {
      id: p.id,
      name: p.name,
      keyHint: p.keyHint || "your API key",
      keyPattern: pat,
      modelsPublic: Boolean(p.keylessModels),
      models: Array.isArray(p.models) ? p.models : [],
      source: p.source,
    };
  });

const fallbackMerged: MergedProvider[] = BYOK_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
  keyHint: p.keyHint,
  keyPattern: p.keyPattern,
  modelsPublic: p.modelsPublic,
  models: p.models,
  source: "builtin" as const,
}));

// AI provider card (top of the Settings tab): pick a provider, save your own
// API key for it (per-provider, localStorage only), pick one of its live
// models — chats then run on that provider with that key. The key is never
// saved in the app's database; it only travels as a header on chat requests.
// Admin-added providers (via /api/providers) appear here for every user.
export const ByokCard = () => {
  const stored = getByokConfig();
  const [providerId, setProviderId] = useState<string>(stored?.provider ?? "");
  const [model, setModel] = useState<string>(stored?.model ?? "");
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>(() => {
    const map = { ...(stored?.apiKeys ?? {}) } as Record<string, string>;
    if (stored?.provider && stored.apiKey && !map[stored.provider]) {
      map[stored.provider] = stored.apiKey;
    }
    return map;
  });
  const [apiKey, setApiKey] = useState<string>(stored?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [keySavedAt, setKeySavedAt] = useState<number | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>(
    (stored?.models as Record<string, string[]>) ?? {}
  );
  const [freeModelsByProvider, setFreeModelsByProvider] = useState<Record<string, string[]>>(
    (stored?.freeModels as Record<string, string[]>) ?? {}
  );
  const [freeOnly, setFreeOnly] = useState<boolean>(stored?.freeOnly === true);
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [verifying, setVerifying] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsNote, setModelsNote] = useState<string | null>(null);
  const [serverProviders, setServerProviders] = useState<MergedProvider[] | null>(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<ApiResponse<{ providers: ServerProviderInfo[] }>>("/api/providers")
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.providers;
        if (Array.isArray(list) && list.length > 0) setServerProviders(toMerged(list));
        else setServerProviders(fallbackMerged);
      })
      .catch(() => {
        if (!cancelled) setServerProviders(fallbackMerged);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedProviders = serverProviders ?? fallbackMerged;

  const provider = useMemo<MergedProvider | null>(() => {
    if (!providerId) return null;
    const hit = mergedProviders.find((p) => p.id === providerId);
    if (hit) return hit;
    // Fallback to static registry for offline or before server list loads
    const s = getByokProvider(providerId);
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      keyHint: s.keyHint,
      keyPattern: s.keyPattern,
      modelsPublic: s.modelsPublic,
      models: s.models,
      source: "builtin",
    };
  }, [providerId, mergedProviders]);

  const liveList = provider ? modelsByProvider[provider.id] : undefined;
  const baseOptions = liveList && liveList.length > 0 ? liveList : (provider?.models ?? []);
  const modelOptions = baseOptions;

  const savedKey = provider ? (savedKeys[provider.id] ?? "") : "";
  const keySupported = provider ? provider.keyPattern.test(apiKey.trim()) : false;
  // Also support legacy per-provider check for built-ins (pattern kept in sync)
  const keySupportedAlt = (() => {
    if (!provider || keySupported) return keySupported;
    const s = getByokProvider(provider.id);
    return s ? isByokKeyFormatSupported(s, apiKey) : keySupported;
  })();
  const effectiveSupported = keySupported || keySupportedAlt;
  const keyIsSaved = effectiveSupported && apiKey.trim() === savedKey.trim() && savedKey.length > 0;

  useEffect(() => {
    saveByokConfig({
      provider: providerId || null,
      model,
      apiKey: providerId ? (savedKeys[providerId] ?? "") : "",
      apiKeys: savedKeys,
      models: modelsByProvider,
      freeModels: freeModelsByProvider,
      freeOnly,
    });
  }, [providerId, model, savedKeys, modelsByProvider, freeModelsByProvider, freeOnly]);

  useEffect(() => {
    if (!provider) {
      setModelsLoading(false);
      setModelsNote(null);
      return;
    }
    const withKey =
      savedKey && provider.keyPattern.test(savedKey.trim())
        ? savedKey.trim()
        : effectiveSupported
          ? apiKey.trim()
          : undefined;
    // Always attempt the live list on select — many OpenAI-compatible
    // endpoints serve /models openly, so URL-added providers (which carry
    // no fallback list) populate with zero typing. The key prompt below
    // only shows when truly empty-handed.
    const seq = ++fetchSeq.current;
    setModelsLoading(true);
    setModelsNote(null);
    void fetchByokModels(provider.id, withKey)
      .then(({ models, freeIds: fetchedFree, message }) => {
        if (fetchSeq.current !== seq) return;
        setModelsLoading(false);
        if (models.length > 0) {
          setModelsByProvider((prev) => ({ ...prev, [provider.id]: models }));
          setFreeModelsByProvider((prev) => ({ ...prev, [provider.id]: fetchedFree }));
          setModel((prev) => (models.includes(prev) ? prev : models[0]));
        } else {
          setModelsNote(
            message ??
              (!withKey && !provider.modelsPublic
                ? `Enter your ${provider.name} API key (format is checked live) to load its live model list.`
                : "Could not load the live list — showing a built-in shortlist.")
          );
          if (provider.models.length > 0) setModel((prev) => prev || provider.models[0]);
        }
      })
      .catch(() => {
        if (fetchSeq.current !== seq) return;
        setModelsLoading(false);
        setModelsNote("Could not load the live list — showing a built-in shortlist.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, savedKey, effectiveSupported, apiKey]);

  const onProviderChange = (next: string) => {
    const nid = next.trim().toLowerCase();
    setProviderId(nid);
    setVerifyState(null);
    setKeySavedAt(null);
    setLoadNote(null);
    setShowKey(false);
    setApiKey(nid ? (savedKeys[nid] ?? "") : "");
    setModel((prev) => {
      if (!nid) return "";
      const hit = mergedProviders.find((p) => p.id === nid) ?? (getByokProvider(nid) ? { id: nid, models: getByokProvider(nid)!.models } as any : null);
      const live = modelsByProvider[nid] ?? [];
      const all = live.length > 0 ? live : (hit?.models ?? []);
      if (prev && all.includes(prev)) return prev;
      return all[0] ?? "";
    });
  };

  const loadKey = () => {
    if (!provider) return;
    const storedNow = getByokConfig();
    const fromStore = storedNow?.apiKeys?.[provider.id] ?? "";
    const known = fromStore || savedKeys[provider.id] || "";
    setApiKey(known);
    setVerifyState(null);
    setKeySavedAt(null);
    setLoadNote(known ? "Loaded the locally saved key." : "No saved key for this provider on this device.");
  };

  const saveKey = () => {
    if (!provider) return;
    const trimmed = apiKey.trim();
    const next = { ...savedKeys };
    if (trimmed) next[provider.id] = trimmed;
    else delete next[provider.id];
    setSavedKeys(next);
    setKeySavedAt(Date.now());
    if (trimmed && !verifyState) {
      const hasModel = model.trim().length > 0;
      setVerifyState({
        ok: hasModel,
        message: hasModel ? "Key saved locally — chats now use it with the selected model." : "Key saved locally — select a model to activate it.",
      });
    }
  };

  const verify = async () => {
    if (!provider || !effectiveSupported || verifying) return;
    setVerifying(true);
    setVerifyState(null);
    try {
      const res = await apiFetch<ApiResponse<ValidateResult>>("/api/byok/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: apiKey.trim() }),
      });
      const d = res?.data;
      if (d?.verified && Array.isArray(d.models) && d.models.length > 0) {
        setModelsByProvider((prev) => ({ ...prev, [provider.id]: d.models }));
        setFreeModelsByProvider((prev) => ({ ...prev, [provider.id]: Array.isArray(d.freeIds) ? d.freeIds : [] }));
        if (!d.models.includes(model)) setModel(d.models[0]);
      }
      const ok = Boolean(d?.verified);
      setVerifyState({ ok, message: d?.message || "" });
      if (ok) {
        setSavedKeys((prev) => ({ ...prev, [provider.id]: apiKey.trim() }));
        setKeySavedAt(Date.now());
      }
    } catch {
      setVerifyState({ ok: false, message: "Could not reach the server to verify this key." });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="account-card byok-card">
      <h3 className="account-card-title">AI provider</h3>
      <div className="account-fields">
        <div>
          <label className="account-field-label" htmlFor="byok-provider">Provider</label>
          <select id="byok-provider" className="account-select" value={providerId} onChange={(e) => onProviderChange(e.target.value)}>
            <option value="">Default (built-in OpenRouter)</option>
            {mergedProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.source === "custom" ? "(custom)" : "(your key)"}
              </option>
            ))}
          </select>
        </div>
        {provider ? (
          <>
            <div>
              <label className="account-field-label" htmlFor="byok-model">
                Model <span className="account-font-size-value">{modelsLoading ? "loading..." : `${modelOptions.length} available`}</span>
              </label>
              <select id="byok-model" className="account-select" value={model} disabled={modelsLoading && modelOptions.length === 0} onChange={(e) => setModel(e.target.value)}>
                {model && !modelOptions.includes(model) ? <option value={model}>{model}</option> : null}
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {modelsNote ? <span className="account-check-hint">{modelsNote}</span> : null}
            </div>
            <div>
              <label className="account-field-label" htmlFor="byok-key">
                API key <span className="account-font-size-value">{provider.keyHint}</span>
              </label>
              <div className="byok-key-wrap">
                <Input
                  id="byok-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={`Enter your ${provider.name} API key`}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setVerifyState(null);
                    setKeySavedAt(null);
                    setLoadNote(null);
                  }}
                />
                <button type="button" className="byok-key-eye" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? "Hide API key" : "Show API key"} title={showKey ? "Hide API key" : "Show API key"}>
                  <i className={`bi ${showKey ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
                </button>
              </div>
              {apiKey.trim().length > 0 ? (
                <span className={`byok-key-status ${effectiveSupported ? "byok-key-status--ok" : "byok-key-status--bad"}`}>
                  {effectiveSupported ? (keyIsSaved ? "Supported & saved — your chats use this key." : "Supported format — press Save key to use it.") : `This doesn't look like a ${provider.name} key (expected ${provider.keyHint}).`}
                </span>
              ) : savedKey ? (
                <span className="byok-key-status byok-key-status--ok">Saved key in use. </span>
              ) : null}
              <div className="byok-actions">
                <Button type="button" variant="outline" onClick={saveKey} disabled={!provider || (apiKey.trim().length > 0 && !effectiveSupported)}>
                  {keySavedAt ? "Saved ✓" : "Save key"}
                </Button>
                <Button type="button" variant="outline" onClick={loadKey} disabled={!provider}>Load saved</Button>
                <Button type="button" variant="outline" onClick={verify} disabled={!effectiveSupported || verifying}>{verifying ? "Verifying..." : "Verify key"}</Button>
                {verifyState ? <span className={`byok-key-status ${verifyState.ok ? "byok-key-status--ok" : "byok-key-status--bad"}`}>{verifyState.message}</span> : null}
                {!verifyState && loadNote ? <span className="byok-key-status byok-key-status--ok">{loadNote}</span> : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ByokCard;
