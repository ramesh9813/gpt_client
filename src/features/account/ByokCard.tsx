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

// Add-on provider card (top of the Settings tab): pick a provider, paste your
// own API key, pick one of its live models — chats then run on that provider
// with that key. Everything is persisted to localStorage only; the key never
// touches the app's database.
export const ByokCard = () => {
  const stored = getByokConfig();
  const [providerId, setProviderId] = useState<ByokProviderId | "">(
    stored?.provider ?? ""
  );
  const [model, setModel] = useState<string>(stored?.model ?? "");
  const [apiKey, setApiKey] = useState<string>(stored?.apiKey ?? "");
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

  const keySupported = provider
    ? isByokKeyFormatSupported(provider, apiKey)
    : false;

  // Persist every change straight to localStorage (no server round-trip).
  useEffect(() => {
    saveByokConfig({
      provider: providerId || null,
      model,
      apiKey,
      models: modelsByProvider,
    });
  }, [providerId, model, apiKey, modelsByProvider]);

  // Live model catalog: fetch on provider select (keyless providers), and
  // again whenever the key becomes well-formed. Newest request wins.
  useEffect(() => {
    if (!provider) {
      setModelsLoading(false);
      setModelsNote(null);
      return;
    }
    const withKey = keySupported ? apiKey.trim() : undefined;
    if (!provider.modelsPublic && !withKey) {
      setModelsNote(
        `Enter your ${provider.name} API key to load its live model list.`
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
  }, [provider, keySupported, apiKey]);

  const onProviderChange = (next: string) => {
    const nextProvider = getByokProvider(next || null);
    setProviderId((nextProvider?.id ?? "") as ByokProviderId | "");
    setVerifyState(null);
    // A provider switch invalidates the previous key/model selection.
    setApiKey("");
    setModel(nextProvider ? (modelsByProvider[nextProvider.id]?.[0] ?? nextProvider.models[0] ?? "") : "");
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
      setVerifyState({
        ok: Boolean(d?.supported),
        message: d?.message || "",
      });
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
        Chat using your own API key — OpenRouter, OpenAI, Google, Grok, Meta or
        NVIDIA. The key is stored only in this browser&apos;s local storage and
        is sent with chat requests, never saved in the app&apos;s database.
        Pick &quot;Default&quot; to use the built-in models instead.
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
                  "Live list from the provider; updates automatically once your key is entered."}
              </span>
            </div>
            <div>
              <label className="account-field-label" htmlFor="byok-key">
                API key{" "}
                <span className="account-font-size-value">
                  {provider.keyHint}
                </span>
              </label>
              <Input
                id="byok-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={`Enter your ${provider.name} API key`}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setVerifyState(null);
                }}
              />
              {apiKey.trim().length > 0 ? (
                <span
                  className={`byok-key-status ${
                    keySupported
                      ? "byok-key-status--ok"
                      : "byok-key-status--bad"
                  }`}
                >
                  {keySupported
                    ? "Supported — your chats now use this key with the selected model."
                    : `This doesn't look like a ${provider.name} key (expected ${provider.keyHint}).`}
                </span>
              ) : null}
              <div className="byok-actions">
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
                Image/video/quiz tools always use the built-in models; your key
                is used for plain text chats.
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ByokCard;
