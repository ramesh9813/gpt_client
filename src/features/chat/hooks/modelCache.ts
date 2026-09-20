// Local model-catalog cache (stale-while-revalidate). Split from useChatModels.
export type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  expiration_date?: string | null;
  is_deprecated?: boolean;
  status?: string;
  speed_rank?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: { prompt: string; completion: string; image?: string };
};

export type CachedCatalog = {
  fetchedAt: string;
  models: OpenRouterModel[];
};

export type ModelsMeta = {
  total?: number;
  source?: "authed" | "fallback";
  fetchedAt?: string;
};

export const CATALOG_CACHE_KEY = "app-models";

export const isDeprecatedModel = (
  m: OpenRouterModel | string | null | undefined
): boolean => {
  if (!m) return true;
  if (typeof m === "string") {
    const id = m.toLowerCase();
    return (
      id.endsWith(":online") ||
      id.endsWith(":thinking") ||
      id.endsWith(":extended") ||
      id.endsWith(":deprecated") ||
      id.includes("/deprecated") ||
      /\b(deprecated|discontinued|sunsetted|decommissioned)\b/i.test(id)
    );
  }

  // 1. OpenRouter expiration_date indicates scheduled/active deprecation
  if (
    typeof m.expiration_date === "string" &&
    m.expiration_date.trim().length > 0
  ) {
    return true;
  }

  // 2. Explicit deprecation or status flag
  if (m.is_deprecated === true || m.status === "deprecated") {
    return true;
  }

  const id = (m.id || "").toLowerCase();
  const name = (m.name || "").toLowerCase();
  const desc = (m.description || "").toLowerCase();

  // 3. Known deprecated OpenRouter model variants
  if (
    id.endsWith(":online") ||
    id.endsWith(":thinking") ||
    id.endsWith(":extended") ||
    id.endsWith(":deprecated") ||
    id.includes("/deprecated")
  ) {
    return true;
  }

  // 4. Deprecation keywords in model ID, display name, or description
  if (
    /\b(deprecated|discontinued|sunsetted|decommissioned)\b/i.test(name) ||
    /\b(deprecated|discontinued|sunsetted|decommissioned)\b/i.test(id) ||
    /\b(is deprecated|has been deprecated|model is deprecated|no longer supported)\b/i.test(desc)
  ) {
    return true;
  }

  return false;
};

const isCachedCatalog = (value: unknown): value is CachedCatalog => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CachedCatalog>;
  return (
    typeof entry.fetchedAt === "string" &&
    Array.isArray(entry.models) &&
    entry.models.every(
      (m): m is OpenRouterModel =>
        !!m && typeof m === "object" && typeof (m as OpenRouterModel).id === "string"
    )
  );
};

export const readCatalogCache = (): CachedCatalog | null => {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCachedCatalog(parsed)) return null;
    const filteredModels = parsed.models.filter((m) => !isDeprecatedModel(m));
    return {
      ...parsed,
      models: filteredModels,
    };
  } catch {
    return null;
  }
};

export const writeCatalogCache = (entry: CachedCatalog): void => {
  try {
    const cleanEntry: CachedCatalog = {
      ...entry,
      models: entry.models.filter((m) => !isDeprecatedModel(m)),
    };
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cleanEntry));
  } catch {
    // best-effort: private mode / quota — catalog still works for this session
  }
};

