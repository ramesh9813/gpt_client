import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { apiFetch, type ApiResponse } from "../../lib/api";
import {
  BYOK_PROVIDERS,
  getByokProvider,
  type ServerProviderInfo,
} from "../../lib/byok";
import {
  getTranscribeConfig,
  savedKeyForProvider,
  saveTranscribeConfig,
  transcribeModelsFor,
} from "../../lib/transcribe";

type VerifyState = { ok: boolean; message: string } | null;

type MergedProvider = {
  id: string;
  name: string;
  keyHint: string;
  keyPattern: RegExp;
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
      source: p.source,
    };
  });

const fallbackMerged: MergedProvider[] = BYOK_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
  keyHint: p.keyHint,
  keyPattern: p.keyPattern,
  source: "builtin" as const,
}));

// Voice transcription picker: choose which engine turns mic + audio files
// into text. Default runs fully on this device (free). A provider model is
// faster and sharper but needs that provider's key saved in the AI provider
// card above — verify checks exactly that. Choice persists locally.
export const TranscribeCard = () => {
  const stored = getTranscribeConfig();
  const [providerId, setProviderId] = useState<string>(stored?.provider ?? "");
  const [model, setModel] = useState<string>(stored?.model ?? "");
  const [customModel, setCustomModel] = useState<string>("");
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [serverProviders, setServerProviders] = useState<MergedProvider[] | null>(null);

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
    const s = getByokProvider(providerId);
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      keyHint: s.keyHint,
      keyPattern: s.keyPattern,
      source: "builtin",
    };
  }, [providerId, mergedProviders]);

  const knownModels = transcribeModelsFor(providerId || null);
  const useCustomModelInput = !!provider && knownModels.length === 0;
  const effectiveModel = useCustomModelInput ? customModel.trim() : model;

  // Persist every explicit choice so mic + audio files use it immediately.
  useEffect(() => {
    saveTranscribeConfig({
      provider: providerId || null,
      model: useCustomModelInput ? customModel.trim() : model,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, model, customModel]);

  const onProviderChange = (next: string) => {
    const nid = next.trim().toLowerCase();
    setProviderId(nid);
    setVerifyState(null);
    const known = transcribeModelsFor(nid || null);
    setModel(known[0] ?? "");
    setCustomModel("");
  };

  const verify = () => {
    if (!provider) {
      setVerifyState({
        ok: true,
        message: "Using the on-device default — mic and audio files transcribe on this phone, free.",
      });
      return;
    }
    if (!effectiveModel) {
      setVerifyState({ ok: false, message: "Pick a transcription model first." });
      return;
    }
    const saved = savedKeyForProvider(provider.id);
    if (!saved) {
      setVerifyState({
        ok: false,
        message: "You did not mention the API key above — save it in the AI provider card first, then verify again.",
      });
      return;
    }
    if (!provider.keyPattern.test(saved.trim())) {
      setVerifyState({
        ok: false,
        message: `The saved key doesn't look like a ${provider.name} key (expected ${provider.keyHint}).`,
      });
      return;
    }
    setVerifyState({
      ok: true,
      message: `Verified — mic and audio files will transcribe with ${effectiveModel}. Stopping the recording turns it into text.`,
    });
  };

  return (
    <div className="account-card byok-card">
      <h3 className="account-card-title">Voice transcription</h3>
      <p className="account-card-desc">
        Pick the engine that turns mic recordings and audio files into text.
        Default runs fully on this device. A provider model is faster — it
        uses the key saved in the AI provider card above.
      </p>
      <div className="account-fields">
        <div>
          <label className="account-field-label" htmlFor="tr-provider">Provider</label>
          <select
            id="tr-provider"
            className="account-select"
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            <option value="">Default (on-device)</option>
            {mergedProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.source === "custom" ? "(custom)" : "(your key)"}
              </option>
            ))}
          </select>
        </div>
        {provider ? (
          <div>
            <label className="account-field-label" htmlFor="tr-model">
              Model <span className="account-font-size-value">{provider.keyHint}</span>
            </label>
            {useCustomModelInput ? (
              <input
                id="tr-model"
                className="account-select"
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value);
                  setVerifyState(null);
                }}
                placeholder="e.g. whisper-large-v3-turbo"
                spellCheck={false}
                autoComplete="off"
              />
            ) : (
              <select
                id="tr-model"
                className="account-select"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setVerifyState(null);
                }}
              >
                {knownModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>
        ) : null}
        <div className="byok-actions">
          <Button type="button" variant="outline" onClick={verify}>
            Verify
          </Button>
          {verifyState ? (
            <span
              className={`byok-key-status ${verifyState.ok ? "byok-key-status--ok" : "byok-key-status--bad"}`}
            >
              {verifyState.message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TranscribeCard;
