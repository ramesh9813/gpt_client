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
import { useMe, useSettings } from "../../../lib/hooks";
import { formatUpdatedAgo } from "../utils/formatUpdatedAgo";

export type SortOption = "name" | "cheapest" | "free" | "speed";

export type ModelOption = {
  label: string;
  value: string;
  supportsResearch?: boolean;
  supportsImage?: boolean;
  supportsVideo?: boolean;
};

export type ModelsStale = { offline: boolean; updatedAgo: string };

// Dedicated deep-research models (e.g. perplexity/sonar-deep-research,
// openai/o3-deep-research) autonomously search and synthesize reports.
export const isDeepResearchModel = (id?: string, name?: string) => {
  const haystack = `${id || ""} ${name || ""}`.toLowerCase();
  return /deep[-_ ]?research/.test(haystack);
};

// Prompt-intent detectors mirror gpt_server/src/modules/chat/intents.ts so
// the client can pre-route image/video prompts to the configured models.
const IMAGE_PROMPT_INTENT = /\b(generat\w*|creat\w*|draw\w*|paint\w*|design\w*|render\w*|mak\w*|produc\w*)\b.{0,50}\b(image|picture|photo|artwork|logo|illustration|avatar|banner|drawing|painting|wallpaper|icon)\b|\b(image|picture|photo|logo)\s+of\b|\bdraw\s+me\b/i;
const VIDEO_PROMPT_INTENT = /\b(generat\w*|creat\w*|mak\w*|develop\w*|build\w*|produc\w*|direct\w*)\b.{0,50}\b(video|clip|animation|movie|reel|short film|footage)\b|\bvideo\s+of\b/i;

export const wantsImagePrompt = (text: string): boolean =>
  IMAGE_PROMPT_INTENT.test(text || "");
export const wantsVideoPrompt = (text: string): boolean =>
  VIDEO_PROMPT_INTENT.test(text || "");

// Capability probe shared by the composer menu and the settings selects.
// Professional source: OpenRouter catalog entry architecture.output_modalities
// with the same name-keyword fallback the server uses in lib/openrouter.ts.
export const modelCapabilities = (m: OpenRouterModel) => {
  const out = m.architecture?.output_modalities;
  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  const supportsImage =
    (Array.isArray(out) && out.includes("image")) ||
    id.includes("image") ||
    name.includes("image") ||
    id.includes("flux");
  const supportsVideo =
    (Array.isArray(out) && out.includes("video")) ||
    id.includes("video") ||
    name.includes("video");
  return { supportsImage, supportsVideo };
};

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
    const sorted = [...models].sort((a, b) => {
      if (sortBy === "name") {
        const left = a.name || a.id;
        const right = b.name || b.id;
        return left.localeCompare(right);
      }
      if (sortBy === "cheapest") {
        const priceA =
          parseFloat(a.pricing?.prompt || "0") +
          parseFloat(a.pricing?.completion || "0");
        const priceB =
          parseFloat(b.pricing?.prompt || "0") +
          parseFloat(b.pricing?.completion || "0");
        return priceA - priceB;
      }
      if (sortBy === "free") {
        const isFreeA =
          parseFloat(a.pricing?.prompt || "0") +
            parseFloat(a.pricing?.completion || "0") ===
          0;
        const isFreeB =
          parseFloat(b.pricing?.prompt || "0") +
            parseFloat(b.pricing?.completion || "0") ===
          0;
        if (isFreeA && !isFreeB) return -1;
        if (!isFreeA && isFreeB) return 1;
        const left = a.name || a.id;
        const right = b.name || b.id;
        return left.localeCompare(right);
      }
      if (sortBy === "speed") {
        const rankA = typeof a.speed_rank === "number" ? a.speed_rank : 99999;
        const rankB = typeof b.speed_rank === "number" ? b.speed_rank : 99999;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        const left = a.name || a.id;
        const right = b.name || b.id;
        return left.localeCompare(right);
      }
      return 0;
    });
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
  }, [model, modelOptions, modelsLoading, persistModel]);

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

  return {
    model,
    setModel,
    imageModel,
    videoModel,
    resolveModelForPrompt,
    sortBy,
    setSortBy,
    modelOptions,
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
};

export type ChatModelsApi = ReturnType<typeof useChatModels>;
