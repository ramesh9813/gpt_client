import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../../lib/api";
import { useMe, useSettings } from "../../../lib/hooks";

export type SortOption = "name" | "cheapest" | "free";

type OpenRouterModel = {
  id: string;
  name?: string;
  pricing?: { prompt: string; completion: string };
};

export type ModelOption = { label: string; value: string };

export const useChatModels = () => {
  const [model, setModelState] = useState("default");
  const modelInitialized = useRef(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const { data: meData } = useMe();
  const currentRole = meData?.data?.user?.role;
  const isFreeRole = currentRole === "user";

  const { data: settingsData } = useSettings(!!meData?.data?.user);

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
  const setModel = useCallback((next: string) => {
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

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () =>
      apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>("/api/models"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const dynamicModelOptions = useMemo(() => {
    const models = modelsData?.data?.models ?? [];
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
      return 0;
    });
    const seen = new Set<string>();

    return sorted
      .filter((m) => {
        if (!m?.id) return false;
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
        return {
          label: name.trim(),
          value: m.id,
        };
      });
  }, [modelsData?.data?.models, sortBy]);

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
      setModel("default");
    }
  }, [model, modelOptions, modelsLoading]);

  return {
    model,
    setModel,
    sortBy,
    setSortBy,
    modelOptions,
    modelsLoading,
    modelsData,
  };
};

export type ChatModelsApi = ReturnType<typeof useChatModels>;
