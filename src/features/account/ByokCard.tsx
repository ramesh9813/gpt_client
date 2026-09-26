import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiFetch, type ApiResponse } from "../../lib/api";
import {
  BYOK_PROVIDERS,
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

// Add-on provider card (Settings tab): pick a provider + model, paste your own
// API key, and chat with it. Everything is persisted to localStorage only —
// the key never touches the app's database.
export const ByokCard = () => {
  const stored = getByokConfig();
  const [providerId, setProviderId] = useState<ByokProviderId | "">(
    stored?.provider ?? ""
  );
  const [model, setModel] = useState<string>(stored?.model ?? "");
  const [apiKey, setApiKey] = useState<string>(stored?.apiKey ?? "");
  const [enabled, setEnabled] = useState<boolean>(stored?.enabled ?? false);
  const [verifiedModels, setVerifiedModels] = useState<
    Partial<Record<ByokProviderId, string[]>>
  >(stored?.verifiedModels ?? {});
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [verifying, setVerifying] = useState(false);

  const provider = getByokProvider(providerId || null);

  const liveList = provider ? verifiedModels[provider.id] : undefined;
  const modelOptions =
    liveList && liveList.length > 0
      ? liveList
      : provider?.models ?? [];

  const keySupported = provider
    ? isByokKeyFormatSupported(provider, apiKey)
    : false;

  // Persist every change straight to localStorage (no server round-trip).
  useEffect(() => {
    saveByokConfig({
      provider: providerId || null,
      model,
      apiKey,
      enabled: Boolean(providerId) && enabled && keySupported,
      verifiedModels,
    });
  }, [providerId, model, apiKey, enabled, keySupported, verifiedModels]);

  const onProviderChange = (next: string) => {
    const nextProvider = getByokProvider(next || null);
    setProviderId((nextProvider?.id ?? "") as ByokProviderId | "");
    setVerifyState(null);
    // A provider switch invalidates the previous key/model selection.
    setApiKey("");
    setEnabled(false);
    const nextLive = nextProvider ? verifiedModels[nextProvider.id] : undefined;
    setModel(
      (nextLive && nextLive.length > 0 ? nextLive : nextProvider?.models)?.[0] ??
        ""
    );
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
        setVerifiedModels((prev) => ({ ...prev, [provider.id]: d.models }));
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
      <h3 className="account-card-title">Add-on provider (BYOK)</h3>
      <p className="account-card-desc">
        Chat using your own OpenAI, Google, Grok, Meta or NVIDIA API key. The
        key is stored only in this browser&apos;s local storage and is never
        saved in the app&apos;s database.
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
                {p.name}
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
                  {modelOptions.length} available
                </span>
              </label>
              <select
                id="byok-model"
                className="account-select"
                value={model}
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
                Verify your key to load the live model list for it; until then a
                curated list is shown.
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
                    ? "Supported"
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
            </div>
            <label className="account-check-row">
              <input
                type="checkbox"
                className="account-check-input"
                checked={enabled}
                disabled={!keySupported}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="account-check-body">
                <span className="account-field-label account-check-label">
                  Chat with {provider.name}
                </span>
                <span className="account-check-hint">
                  When on, your chats use {provider.name} with the selected
                  model and key. Turn off to return to the built-in models.
                  Image/video/quiz tools always use the built-in models.
                </span>
              </span>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ByokCard;
