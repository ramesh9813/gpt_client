import type { OpenRouterModel } from "./modelCache";

// Dedicated deep-research models (e.g. perplexity/sonar-deep-research,
// openai/o3-deep-research) autonomously search and synthesize reports.
// Matches id + display name + catalog description: several capable models
// don't carry "deep-research" in the id (agentic researchers, Perplexity
// Sonar search-grounded family). Deliberately NOT bare "research" —
// "research preview" tags mark experimental models, not researchers.
const DEEP_RESEARCH_RE = /deep[-_ ]?research/;
const AGENTIC_RESEARCH_RE = /agentic[-_ ]?research|research[-_ ]?agent/;
const SONAR_RE = /(^|\/)sonar[-_:]/;
export const isDeepResearchModel = (id?: string, name?: string, description?: string) => {
  const idName = `${id || ""} ${name || ""}`.toLowerCase();
  if (DEEP_RESEARCH_RE.test(idName)) return true;
  if (SONAR_RE.test((id || "").toLowerCase())) return true;
  const desc = (description || "").toLowerCase();
  if (!desc) return false;
  return DEEP_RESEARCH_RE.test(desc) || AGENTIC_RESEARCH_RE.test(desc);
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

export const compareModels = (
  a: OpenRouterModel,
  b: OpenRouterModel,
  sortBy: "name" | "cheapest" | "free" | "speed"
): number => {
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
};
