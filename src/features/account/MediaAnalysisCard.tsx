import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, type ApiResponse } from "../../lib/api";
import { useSettings } from "../../lib/hooks";
import {
  BYOK_PROVIDERS,
  fetchByokModels,
  getByokConfig,
  getByokProvider,
  saveByokConfig,
  savedByokProviders,
  subscribeByok,
  type ServerProviderInfo,
} from "../../lib/byok";
import {
  describeChatModel,
  getMediaModelsConfig,
  saveMediaModelsConfig,
  type MediaKind,
} from "../../lib/mediaModels";

type MergedProvider = { id: string; name: string };

const toMerged = (list: ServerProviderInfo[]): MergedProvider[] =>
  list.map((p) => ({ id: p.id, name: p.name }));

const fallbackMerged: MergedProvider[] = BYOK_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
}));

// Live model list for one card block: cached catalog first, static
// shortlist next, server refresh in the background (saved key required).
const useBlockModels = (providerId: string | null) => {
  const [models, setModels] = useState<string[]>(() => {
    if (!providerId) return [];
    const cfg = getByokConfig();
    const live = cfg?.models?.[providerId];
    if (live && live.length > 0) return [...live];
    return [...(getByokProvider(providerId)?.models ?? [])];
  });
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!providerId) {
      setModels([]);
      setLoading(false);
      return;
    }
    const cfg = getByokConfig();
    const live = cfg?.models?.[providerId];
    if (live && live.length > 0) {
      setModels([...live]);
      return;
    }
    setModels([...(getByokProvider(providerId)?.models ?? [])]);
    const key =
      cfg?.apiKeys?.[providerId] ??
      (cfg?.provider === providerId ? cfg.apiKey : "");
    if (!key) return;
    const cur = ++seq.current;
    setLoading(true);
    void fetchByokModels(providerId, key)
      .then(({ models: list, freeIds }) => {
        if (seq.current !== cur) return;
        setLoading(false);
        if (list.length > 0) {
          const latest = getByokConfig();
          saveByokConfig({
            ...(latest ?? { provider: null, model: "", apiKey: "" }),
            models: { ...(latest?.models ?? {}), [providerId]: list },
            freeModels: { ...(latest?.freeModels ?? {}), [providerId]: freeIds },
          });
          setModels([...list]);
        }
      })
      .catch(() => {
        if (seq.current !== cur) return;
        setLoading(false);
      });
  }, [providerId]);

  return { models, loading };
};

const MediaBlock = ({
  kind,
  title,
  desc,
  providers,
  providerId,
  model,
  customModel,
  onProviderChange,
  onModelChange,
  onCustomModelChange,
  chatLabel,
}: {
  kind: MediaKind;
  title: string;
  desc: string;
  providers: MergedProvider[];
  providerId: string;
  model: string;
  customModel: string;
  onProviderChange: (kind: MediaKind, id: string) => void;
  onModelChange: (kind: MediaKind, model: string) => void;
  onCustomModelChange: (kind: MediaKind, model: string) => void;
  chatLabel: string;
}) => {
  const { models, loading } = useBlockModels(providerId || null);
  const showCustomInput = !!providerId && models.length === 0 && !loading;
  return (
    <div style={{ marginTop: kind === "video" ? 16 : 0 }}>
      <h4 className="account-card-title">{title}</h4>
      <p className="account-card-desc">{desc}</p>
      <div className="account-fields">
        <div>
          <label className="account-field-label" htmlFor={`media-prov-${kind}`}>
            Provider
          </label>
          <select
            id={`media-prov-${kind}`}
            className="account-select"
            value={providerId}
            onChange={(e) => onProviderChange(kind, e.target.value)}
          >
            <option value="">Default ({chatLabel})</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (your key)
              </option>
            ))}
          </select>
        </div>
        {providerId ? (
          <div>
            <label className="account-field-label" htmlFor={`media-model-${kind}`}>
              Model{" "}
              <span className="account-font-size-value">
                {loading ? "loading..." : `${models.length} available`}
              </span>
            </label>
            {showCustomInput ? (
              <input
                id={`media-model-${kind}`}
                className="account-select"
                value={customModel}
                onChange={(e) => onCustomModelChange(kind, e.target.value)}
                placeholder="Type model id…"
                spellCheck={false}
                autoComplete="off"
              />
            ) : (
              <select
                id={`media-model-${kind}`}
                className="account-select"
                value={model}
                disabled={loading && models.length === 0}
                onChange={(e) => onModelChange(kind, e.target.value)}
              >
                {model && !models.includes(model) ? (
                  <option value={model}>{model}</option>
                ) : null}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Image/video analysis routing: each card picks the provider+model that
// handles that media kind. Sending a photo runs that turn on the image
// model, sending a video on the video model — the chat model never changes.
export const MediaAnalysisCard = () => {
  const [serverProviders, setServerProviders] = useState<MergedProvider[] | null>(null);
  // "Default" tracks the live chat model (re-read on settings/BYOK changes).
  const { data: settingsData } = useSettings();
  const [byokTick, setByokTick] = useState(0);
  useEffect(() => subscribeByok(() => setByokTick((t) => t + 1)), []);
  void byokTick;
  const chatLabel = describeChatModel(
    (settingsData?.data?.settings as { model?: string } | undefined)?.model
  );

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

  // Keyed providers only (with server display names when known).
  const providers = useMemo<MergedProvider[]>(() => {
    const keyed = new Set(savedByokProviders().map((p) => p.id));
    const base = serverProviders ?? fallbackMerged;
    return base
      .filter((p) => keyed.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [serverProviders]);

  const [imageProvider, setImageProvider] = useState(
    () => getMediaModelsConfig().image.provider ?? ""
  );
  const [imageModel, setImageModel] = useState(
    () => getMediaModelsConfig().image.model
  );
  const [imageCustom, setImageCustom] = useState("");
  const [videoProvider, setVideoProvider] = useState(
    () => getMediaModelsConfig().video.provider ?? ""
  );
  const [videoModel, setVideoModel] = useState(
    () => getMediaModelsConfig().video.model
  );
  const [videoCustom, setVideoCustom] = useState("");

  // Persist every choice; the send path reads it per turn.
  useEffect(() => {
    saveMediaModelsConfig({
      image: { provider: imageProvider || null, model: imageModel },
      video: { provider: videoProvider || null, model: videoModel },
    });
  }, [imageProvider, imageModel, videoProvider, videoModel]);

  const onProviderChange = (kind: MediaKind, id: string) => {
    const nid = id.trim().toLowerCase();
    if (kind === "image") {
      setImageProvider(nid);
      setImageModel("");
      setImageCustom("");
    } else {
      setVideoProvider(nid);
      setVideoModel("");
      setVideoCustom("");
    }
  };

  return (
    <div className="account-card byok-card">
      <h3 className="account-card-title">Photo & video analysis</h3>
      <p className="account-card-desc">
        Choose which model looks at your photos and videos. That request
        alone runs on the selected model — your chat model stays as it is.
      </p>
      <MediaBlock
        kind="image"
        title="Image analysis"
        desc="Used whenever you attach a photo. Default keeps the chat model."
        providers={providers}
        providerId={imageProvider}
        model={imageModel}
        customModel={imageCustom}
        onProviderChange={onProviderChange}
        onModelChange={(_k, m) => setImageModel(m)}
        onCustomModelChange={(_k, m) => {
          setImageCustom(m);
          setImageModel(m.trim());
        }}
        chatLabel={chatLabel}
      />
      <MediaBlock
        kind="video"
        title="Video analysis"
        desc="Used whenever you attach a video. Default keeps the chat model."
        providers={providers}
        providerId={videoProvider}
        model={videoModel}
        customModel={videoCustom}
        onProviderChange={onProviderChange}
        onModelChange={(_k, m) => setVideoModel(m)}
        onCustomModelChange={(_k, m) => {
          setVideoCustom(m);
          setVideoModel(m.trim());
        }}
        chatLabel={chatLabel}
      />
    </div>
  );
};

export default MediaAnalysisCard;
