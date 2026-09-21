import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../lib/api";
import { isDeprecatedModel, type OpenRouterModel } from "../chat/hooks/modelCache";
import { modelCapabilities } from "../chat/hooks/modelCatalog";
import { shortModelName } from "./settingsForm";

export type ModelSelectOption = { label: string; value: string };

export const useSettingsModels = () => {
  // Live OpenRouter catalog (same ["models"] cache the composer fills —
  // no extra fetch). Professional filter: architecture.output_modalities.
  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () =>
      apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>("/api/models"),
    staleTime: 1000 * 60 * 5,
  });
  const { chatModelOptions, imageModelOptions, videoModelOptions } =
    useMemo(() => {
      const seen = new Set<string>();
      const live = (modelsData?.data?.models ?? []).filter((m) => {
        if (!m?.id || seen.has(m.id) || isDeprecatedModel(m)) return false;
        seen.add(m.id);
        return true;
      });
      const sorted = [...live].sort((a, b) =>
        shortModelName(a).localeCompare(shortModelName(b))
      );
      const label = (m: OpenRouterModel) => ({
        label: shortModelName(m),
        value: m.id,
      });
      return {
        chatModelOptions: sorted.map(label),
        imageModelOptions: sorted
          .filter((m) => modelCapabilities(m).supportsImage)
          .map(label),
        videoModelOptions: sorted
          .filter((m) => modelCapabilities(m).supportsVideo)
          .map(label),
      };
    }, [modelsData]);

  return { chatModelOptions, imageModelOptions, videoModelOptions };
};
