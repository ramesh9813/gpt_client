import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readCatalogCache,
  writeCatalogCache,
  isDeprecatedModel,
  type CachedCatalog,
  type ModelsMeta,
  type OpenRouterModel,
} from "./modelCache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../../lib/api";
import {
  fetchByokModels,
  getActiveByok,
  getByokConfig,
  getByokProvider,
  saveByokConfig,
  subscribeByok,
  type ByokConfig,
} from "../../../lib/byok";
import { useMe, useSettings } from "../../../lib/hooks";
import { formatUpdatedAgo } from "../utils/formatUpdatedAgo";
import {
  compareModels,
  isDeepResearchModel,
  modelCapabilities,
  wantsImagePrompt,
  wantsVideoPrompt,
} from "./modelCatalog";

export { isDeepResearchModel, modelCapabilities, wantsImagePrompt, wantsVideoPrompt };

export type SortOption = "name" | "cheapest" | "free" | "speed";

export type ModelOption = {
  label: string;
  value: string;
  supportsResearch?: boolean;
  supportsImage?: boolean;
  supportsVideo?: boolean;
};

export type ModelsStale = { offline: boolean; updatedAgo: string };

export const useChatModels = () => {
  const [model, setModelState] = useState("default");
  const modelInitialized = useRef(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const { data: meData } = useMe();
  const currentRole = meData?.data?.user?.role;
  const isFreeRole = currentRole === "user";

  const { data: settingsData } = useSettings(!!meData?.data?.user);

  // Stale-while-revalidate: paint instantly from localStorage on mount.
  const [cachedCatalog, setCachedCatalog] = useState<CachedCatalog | null>(() =>
    readCatalogCache()
  );
  const [modelResetNotice, setModelResetNotice] = useState<string | null>(null);
  const [refreshInFlight, setRefreshInFlight] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const queryClient = useQueryClient();

  // Restore last selected model from the database once (sticks across reloads).
  useEffect(() => {
    if (modelInitialized.current) return;
    const saved = settingsData?.data?.settings?.model;
    if (typeof saved === "string" && saved.length > 0) {
      modelInitialized.current = true;
      setModelState(saved);
    }
  }, [settingsData]);

  // Persist every explicit change so the next load restores it.
  const persistModel = useCallback((next: string) => {
    modelInitialized.current = true;
    setModelState(next);
    void apiFetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: next }),
    }).catch(() => {
      // best-effort: model still works for this session
    });
  }, []);

  // Wrapper: any explicit (valid) selection dismisses the reset notice.
  const setModel = useCallback(
    (next: string) => {
      setModelResetNotice(null);
      persistModel(next);
    },
    [persistModel]
  );

  // ── BYOK (Settings > AI provider) ────────────────────────────────────────
  // When the user has an add-on provider configured (provider + well-formed
  // key + model, all in localStorage), the model menu, active model label and
  // selection persistence all come from THAT provider instead of the
  // OpenRouter catalog below. Nothing else changes.
  const [byokCfg, setByokCfg] = useState<ByokConfig | null>(() =>
    getActiveByok()
  );
  useEffect(
    () => subscribeByok(() => setByokCfg(getActiveByok())),
    []
  );
  const byokActive = !!byokCfg;
  const byokProvider = byokCfg ? getByokProvider(byokCfg.provider) : null;

  const byokList = useMemo(() => {
    if (!byokCfg || !byokProvider) return [];
    const live = byokCfg.models?.[byokProvider.id];
    return live && live.length > 0 ? live : byokProvider.models;
  }, [byokCfg, byokProvider]);

  const byokOptions: ModelOption[] = useMemo(
    () =>
      [...byokList]
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({ label: id, value: id })),
    [byokList]
  );

  const [byokFetching, setByokFetching] = useState(false);
  const refreshByokModels = useCallback(async () => {
    if (!byokCfg || !byokProvider) return;
    setByokFetching(true);
    try {
      const list = await fetchByokModels(byokProvider.id, byokCfg.apiKey);
      if (list.length > 0) {
        saveByokConfig({
          ...byokCfg,
          models: { ...(byokCfg.models ?? {}), [byokProvider.id]: list },
        });
      }
    } catch {
      // keep current list
    } finally {
      setByokFetching(false);
    }
  }, [byokCfg, byokProvider]);

  // Fetch the provider catalog once per provider+key when none is cached.
  const byokFetchedFor = useRef<string>("");
  useEffect(() => {
    if (!byokCfg || !byokProvider) return;
    if ((byokCfg.models?.[byokProvider.id]?.length ?? 0) > 0) return;
    const key = `${byokProvider.id}:${byokCfg.apiKey.slice(-8)}`;
    if (byokFetchedFor.current === key) return;
    byokFetchedFor.current = key;
    void refreshByokModels();
  }, [byokCfg, byokProvider, refreshByokModels]);

  // Keep the stored BYOK model inside the current provider list.
  useEffect(() => {
    if (!byokCfg || !byokProvider || byokOptions.length === 0) return;
    if (!byokOptions.some((o) => o.value === byokCfg.model)) {
      saveByokConfig({ ...byokCfg, model: byokOptions[0].value });
    }
  }, [byokCfg, byokProvider, byokOptions]);

  const setByokModel = useCallback((next: string) => {
    const cfg = getByokConfig();
    saveByokConfig({
      provider: cfg?.provider ?? null,
      model: next,
      apiKey: cfg?.apiKey ?? "",
      models: cfg?.models,
    });
  }, []);
  // ── end BYOK ─────────────────────────────────────────────────────────────

  const {
    data: modelsData,
    isLoading: modelsLoading,
    isFetching,
    isError: queryFailed,
    refetch,
  } = useQuery({
    queryKey: ["models"],
    queryFn: () =>
      apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>("/api/models"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Fresh success overwrites the localStorage cache.
  useEffect(() => {
    const fresh = modelsData?.data?.models;
    if (!fresh) return;
    const meta = modelsData?.meta as ModelsMeta | undefined;
    const fetchedAt =
      typeof meta?.fetchedAt === "string" && meta.fetchedAt.length > 0
        ? meta.fetchedAt
        : new Date().toISOString();
    const entry: CachedCatalog = { fetchedAt, models: fresh };
    writeCatalogCache(entry);
    setCachedCatalog(entry);
    setRefreshFailed(false);
  }, [modelsData]);

  // Effective list: live data when present, otherwise the instant cache.
  // This keeps the menu painted on mount (SWR) and swaps in the fresh list
  // on background-refetch success. On failure the cache stays on screen.
  const effectiveModels: OpenRouterModel[] = useMemo(() => {
    const live = modelsData?.data?.models;
    if (live) return live;
    return cachedCatalog?.models ?? [];
  }, [modelsData?.data?.models, cachedCatalog]);

  const metaFetchedAt = (modelsData?.meta as ModelsMeta | undefined)?.fetchedAt;
  const modelsUpdatedAt: string | null =
    typeof metaFetchedAt === "string" && metaFetchedAt.length > 0
      ? metaFetchedAt
      : (cachedCatalog?.fetchedAt ?? null);
  const modelsTotal = effectiveModels.length;

  const offline = queryFailed || refreshFailed;
  const modelsStale: ModelsStale = useMemo(
    () => ({
      offline,
      updatedAgo: formatUpdatedAgo(modelsUpdatedAt),
    }),
    [offline, modelsUpdatedAt]
  );

  // Manual refresh: bypass the 5-min server cache (?refresh=1), then push
  // the result into the ["models"] query so the success effect above swaps
  // the list + overwrites localStorage. On failure keep the cache.
  const refreshModels = useCallback(async (): Promise<void> => {
    setRefreshInFlight(true);
    try {
      const fresh = await apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>(
        "/api/models?refresh=1"
      );
      queryClient.setQueryData(["models"], fresh);
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshInFlight(false);
    }
  }, [queryClient]);

  const dynamicModelOptions = useMemo(() => {
    const models = effectiveModels;
    const sorted = [...models].sort((a, b) => compareModels(a, b, sortBy));
    const seen = new Set<string>();

    return sorted
      .filter((m) => {
        if (!m?.id) return false;
        if (isDeprecatedModel(m)) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map((m) => {
        let name = m.name || m.id;
        if (name.includes(": ")) {
          name = name.split(": ").slice(1).join(": ");
        } else if (name.includes(":")) {
          name = name.split(":").slice(1).join(":");
        }
        const { supportsImage, supportsVideo } = modelCapabilities(m);

        return {
          label: name.trim(),
          value: m.id,
          supportsResearch: isDeepResearchModel(m.id, m.name),
          supportsImage,
          supportsVideo,
        };
      });
  }, [effectiveModels, sortBy]);

  // Fully dynamic: no hardcoded models. List comes from GET /api/models (OpenRouter,
  // role-filtered server-side) on page load. Only sentinel is "default" (server resolves it).
  const modelOptions: ModelOption[] = useMemo(() => {
    return [
      {
        label: isFreeRole ? "Default free model" : "Default model",
        value: "default",
      },
      ...dynamicModelOptions,
    ];
  }, [dynamicModelOptions, isFreeRole]);

  useEffect(() => {
    if (byokActive) return; // BYOK selections live in localStorage, not here
    if (model === "default") return;
    if (modelsLoading) return; // don't reset while list still loading
    const allowed = modelOptions.some((option) => option.value === model);
    if (!allowed) {
      // Selected model vanished from the fresh list: fall back to the
      // "default" sentinel and surface a dismissable notice (cleared by
      // the next explicit setModel call above).
      const missing = model;
      persistModel("default");
      setModelResetNotice(
        `"${missing}" is no longer available — reset to default.`
      );
    }
  }, [model, modelOptions, modelsLoading, persistModel, byokActive]);

  // Per-purpose defaults from Settings. "default" (or unset) means no
  // override — the composer's chat model is used for every turn.
  const settings = settingsData?.data?.settings as
    | { imageModel?: unknown; videoModel?: unknown }
    | undefined;
  const imageModel =
    typeof settings?.imageModel === "string" && settings.imageModel.length > 0
      ? settings.imageModel
      : "default";
  const videoModel =
    typeof settings?.videoModel === "string" && settings.videoModel.length > 0
      ? settings.videoModel
      : "default";

  // Pre-route a prompt to the configured media model: video prompts go to
  // the video model, image prompts to the image model, everything else keeps
  // the composer's chat model. One-turn override — the global selection is
  // never changed, so the next plain message uses the chat model again.
  const resolveModelForPrompt = useCallback(
    (text: string): string => {
      if (wantsVideoPrompt(text) && videoModel !== "default") return videoModel;
      if (wantsImagePrompt(text) && imageModel !== "default") return imageModel;
      return model;
    },
    [model, imageModel, videoModel]
  );

  const base = {
    model,
    setModel,
    imageModel,
    videoModel,
    resolveModelForPrompt,
    sortBy,
    setSortBy,
    modelOptions,
    // Role gates: general users must chat via their own BYOK provider key.
    currentUserRole: currentRole,
    isGeneralUser: currentRole === "user",
    byokActive: false,
    modelsLoading,
    modelsData,
    // Catalog freshness footer data:
    modelsTotal,
    modelsUpdatedAt,
    refreshModels,
    modelsStale,
    modelResetNotice,
    // Extra loading flag so the footer refresh button can spin on refetch
    // (modelsLoading is only true on the first load):
    modelsRefreshing: isFetching || refreshInFlight,
    // Re-export for callers that want the raw refetch:
    refetchModels: refetch,
  };

  // BYOK override: the composer "+" → Model menu lists the user's provider
  // models, the input card shows the selected provider model, and selections
  // persist to localStorage (never the DB). resolveModelForPrompt collapses to
  // the BYOK model — media prompts stay plain chat on the provider.
  if (byokActive && byokCfg && byokProvider) {
    const byokModel = byokCfg.model || byokOptions[0]?.value || "";
      return {
        ...base,
        model: byokModel,
        setModel: setByokModel,
        resolveModelForPrompt: () => byokModel,
        modelOptions: byokOptions,
        byokActive: true,
        modelsLoading: byokFetching && byokOptions.length === 0,
        modelsTotal: byokOptions.length,
        modelsUpdatedAt: null,
        modelsStale: { offline: false, updatedAgo: "live from provider" },
        modelResetNotice: null,
        refreshModels: refreshByokModels,
        modelsRefreshing: byokFetching,
      };
    }

  return base;
};

export type ChatModelsApi = ReturnType<typeof useChatModels>;
