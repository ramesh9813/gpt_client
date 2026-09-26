import { useEffect, useRef, useState } from "react";
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
  type ByokProviderId,
} from "../../lib/byok";

type ValidateResult = {
  supported: boolean;
  verified: boolean;
  models: string[];
  message: string;
};

type VerifyState = { ok: boolean; message: string } | null;

// AI provider card (top of the Settings tab): pick a provider, save your own
// API key for it (per-provider, localStorage only), pick one of its live
// models — chats then run on that provider with that key. The key is never
// saved in the app's database; it only travels as a header on chat requests.
export const ByokCard = () => {
  const stored = getByokConfig();
  const [providerId, setProviderId] = useState<ByokProviderId | "">(
    stored?.provider ?? ""
  );
  const [model, setModel] = useState<string>(stored?.model ?? "");
  // Saved keys per provider (persisted) + the in-flight edit for the current
  // provider. Chat only uses SAVED keys; typing alone changes nothing.
  const [savedKeys, setSavedKeys] = useState<
    Partial<Record<ByokProviderId, string>>
  >(() => {
    const map = { ...(stored?.apiKeys ?? {}) };
    // Migrate pre-per-provider-key configs: a top-level apiKey on the active
    // provider becomes that provider's saved key instead of getting wiped.
    if (stored?.provider && stored.apiKey && !map[stored.provider]) {
      map[stored.provider] = stored.apiKey;
    }
    return map;
  });
  const [apiKey, setApiKey] = useState<string>(stored?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [keySavedAt, setKeySavedAt] = useState<number | null>(null);
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<ByokProviderId, string[]>>
  >(stored?.models ?? {});
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [verifying, setVerifying] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsNote, setModelsNote] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  const provider = getByokProvider(providerId || null);

  const liveList = provider ? modelsByProvider[provider.id] : undefined;
  const modelOptions =
    liveList && liveList.length > 0 ? liveList : (provider?.models ?? []);

  const savedKey = provider ? (savedKeys[provider.id] ?? "") : "";
  const keySupported = provider
    ? isByokKeyFormatSupported(provider, apiKey)
    : false;
  const keyIsSaved = keySupported && apiKey.trim() === savedKey.trim() && savedKey.length > 0;

  // Persist provider/model + saved-keys map to localStorage (per-key saves are
  // explicit via "Save key"; typing alone never activates a draft key).
  useEffect(() => {
    saveByokConfig({
      provider: providerId || null,
      model,
      apiKey: providerId ? (savedKeys[providerId] ?? "") : "",
      apiKeys: savedKeys,
      models: modelsByProvider,
    });
  }, [providerId, model, savedKeys, modelsByProvider]);

  // Live model catalog: fetch on provider select (keyless providers), and
  // again whenever a SAVED key is well-formed. Newest request wins.
  useEffect(() => {
    if (!provider) {
      setModelsLoading(false);
      setModelsNote(null);
      return;
    }
    const withKey =
      savedKey && isByokKeyFormatSupported(provider, savedKey)
        ? savedKey.trim()
        : undefined;
    if (!provider.modelsPublic && !withKey) {
      setModelsNote(
        savedKeys[provider.id] === undefined
          ? `Enter and save your ${provider.name} API key to load its live model list.`
          : "Saved key format changed — save again to refresh the live model list."
      );
      return;
    }
    const seq = ++fetchSeq.current;
    setModelsLoading(true);
    setModelsNote(null);
    void fetchByokModels(provider.id, withKey)
      .then((models) => {
        if (fetchSeq.current !== seq) return;
        setModelsLoading(false);
        if (models.length > 0) {
          setModelsByProvider((prev) => ({ ...prev, [provider.id]: models }));
          setModel((prev) => (models.includes(prev) ? prev : models[0]));
        } else {
          setModelsNote(
            "Could not load the live list — showing a built-in shortlist."
          );
        }
      })
      .catch(() => {
        if (fetchSeq.current !== seq) return;
        setModelsLoading(false);
        setModelsNote(
          "Could not load the live list — showing a built-in shortlist."
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, savedKey]);

  const onProviderChange = (next: string) => {
    const nextProvider = getByokProvider(next || null);
    const nextId = (nextProvider?.id ?? "") as ByokProviderId | "";
    setProviderId(nextId);
    setVerifyState(null);
    setKeySavedAt(null);
    setShowKey(false);
    // Auto-load this provider's previously saved key (if the user saved one).
    setApiKey(nextId ? (savedKeys[nextId] ?? "") : "");
    setModel(
      nextProvider
        ? (modelsByProvider[nextProvider.id]?.[0] ??
            nextProvider.models[0] ??
            "")
        : ""
    );
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
      setVerifyState({
        ok: true,
        message: "Key saved locally — chats now use it with the selected model.",
      });
    }
  };

  const verify = async () => {
    if (!provider || !keySupported || verifying) return;
    setVerifying(true);
    setVerifyState(null);
    try {
      const res = await apiFetch<ApiResponse<ValidateResult>>(
        "/api/byok/validate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: provider.id, apiKey: apiKey.trim() }),
        }
      );
      const d = res?.data;
      if (d?.verified && Array.isArray(d.models) && d.models.length > 0) {
        setModelsByProvider((prev) => ({ ...prev, [provider.id]: d.models }));
        if (!d.models.includes(model)) setModel(d.models[0]);
      }
      const ok = Boolean(d?.supported);
      setVerifyState({
        ok,
        message: d?.message || "",
      });
      // A verified key is clearly intended for use — persist it locally.
      if (ok) {
        setSavedKeys((prev) => ({ ...prev, [provider.id]: apiKey.trim() }));
        setKeySavedAt(Date.now());
      }
    } catch {
      setVerifyState({
        ok: false,
        message: "Could not reach the server to verify this key.",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="account-card byok-card">
      <h3 className="account-card-title">AI provider</h3>
      <p className="account-card-desc">
        Chat using your own API key — OpenRouter, OpenAI, Google, Grok, Meta,
        NVIDIA and more. Keys are stored only in this browser&apos;s local
        storage (use &quot;Save key&quot; to keep one per provider) and are sent
        with chat requests, never saved in the app&apos;s database. Pick
        &quot;Default&quot; to use the built-in models instead.
      </p>
      <div className="account-fields">
        <div>
          <label className="account-field-label" htmlFor="byok-provider">
            Provider
          </label>
          <select
            id="byok-provider"
            className="account-select"
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            <option value="">Default (built-in OpenRouter)</option>
            {BYOK_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (your key)
              </option>
            ))}
          </select>
        </div>
        {provider ? (
          <>
            <div>
              <label className="account-field-label" htmlFor="byok-model">
                Model{" "}
                <span className="account-font-size-value">
                  {modelsLoading
                    ? "loading..."
                    : `${modelOptions.length} available`}
                </span>
              </label>
              <select
                id="byok-model"
                className="account-select"
                value={model}
                disabled={modelsLoading && modelOptions.length === 0}
                onChange={(e) => setModel(e.target.value)}
              >
                {model && !modelOptions.includes(model) ? (
                  <option value={model}>{model}</option>
                ) : null}
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="account-check-hint">
                {modelsNote ??
                  "Live list from the provider; refreshes automatically once your key is saved."}
              </span>
            </div>
            <div>
              <label className="account-field-label" htmlFor="byok-key">
                API key{" "}
                <span className="account-font-size-value">
                  {provider.keyHint}
                </span>
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
                  }}
                />
                <button
                  type="button"
                  className="byok-key-eye"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  title={showKey ? "Hide API key" : "Show API key"}
                >
                  <i
                    className={`bi ${showKey ? "bi-eye-slash" : "bi-eye"}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {apiKey.trim().length > 0 ? (
                <span
                  className={`byok-key-status ${
                    keySupported
                      ? "byok-key-status--ok"
                      : "byok-key-status--bad"
                  }`}
                >
                  {keySupported
                    ? keyIsSaved
                      ? "Supported & saved — your chats use this key."
                      : "Supported format — press Save key to use it."
                    : `This doesn't look like a ${provider.name} key (expected ${provider.keyHint}).`}
                </span>
              ) : savedKey ? (
                <span className="byok-key-status byok-key-status--ok">
                  Saved key in use.{" "}
                </span>
              ) : null}
              <div className="byok-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveKey}
                  disabled={!provider || (apiKey.trim().length > 0 && !keySupported)}
                >
                  {keySavedAt ? "Saved ✓" : "Save key"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={verify}
                  disabled={!keySupported || verifying}
                >
                  {verifying ? "Verifying..." : "Verify key"}
                </Button>
                {verifyState ? (
                  <span
                    className={`byok-key-status ${
                      verifyState.ok
                        ? "byok-key-status--ok"
                        : "byok-key-status--bad"
                    }`}
                  >
                    {verifyState.message}
                  </span>
                ) : null}
              </div>
              <span className="account-check-hint">
                Chat, quiz (mcq), artifacts and Thinking mode run on your
                provider; image/video/web-search tools stay on the built-in
                models.
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ByokCard;
