export type ArtifactBlock = {
  id: string;
  messageId: string;
  language: "html";
  title: string;
  code: string;
  sourceIndex: number;
};

type BasicMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

/**
 * Matches only artifact fences:
 *
 *   ```html:artifact
 *   <html>...</html>
 *   ```
 *
 * Plain ```html fences are intentionally NOT matched here — they belong to
 * the canvas panel (see canvas.ts exclusion).
 */
export const ARTIFACT_FENCE_REGEX = /```html:artifact[ \t]*\r?\n([\s\S]*?)```/g;

const TITLE_TAG_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;

export const ARTIFACT_FALLBACK_TITLE = "Interactive Simulation";

/**
 * Title resolution (shared spec):
 * 1. first <title>...</title> in the HTML (trimmed, inner tags stripped)
 * 2. else first 40 chars of the user prompt (passed in)
 * 3. else "Interactive Simulation"
 */
export const extractArtifactTitle = (
  code: string,
  userPrompt?: string
): string => {
  const tagMatch = TITLE_TAG_REGEX.exec(code || "");
  const fromTag = (tagMatch?.[1] ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (fromTag) return fromTag;
  const prompt = (userPrompt ?? "").trim();
  if (prompt) return prompt.slice(0, 40).trim() || ARTIFACT_FALLBACK_TITLE;
  return ARTIFACT_FALLBACK_TITLE;
};

/**
 * Prompt source for title fallback. A plain string applies to every message;
 * a map / function allows per-message prompts (e.g. the USER turn preceding
 * each assistant message). All three forms resolve to a plain string prompt.
 */
export type ArtifactPromptSource =
  | string
  | Record<string, string>
  | ((messageId: string) => string | undefined);

const resolvePrompt = (
  source: ArtifactPromptSource | undefined,
  messageId: string
): string | undefined => {
  if (source == null) return undefined;
  if (typeof source === "string") return source;
  if (typeof source === "function") return source(messageId);
  return source[messageId];
};

export type ArtifactData = {
  blocks: ArtifactBlock[];
  displayMap: Record<string, string>;
  hasArtifactMap: Record<string, boolean>;
  byId: Record<string, ArtifactBlock>;
};

/**
 * Mirror of canvas.ts buildCanvasData for artifact fences.
 * - messages array → per-assistant-message scan (like canvas)
 * - single text string → scanned as one virtual assistant message
 *   (messageId param keys displayMap/byId parent; defaults to "single")
 * displayMap holds the message text with artifact fences removed so raw
 * HTML doesn't flood the chat; hasArtifactMap flags messages containing
 * at least one artifact; byId indexes blocks by block id.
 * Pure functions only — no React, no side effects.
 */
export const buildArtifactData = (
  messages: BasicMessage[] | string,
  promptSource?: ArtifactPromptSource,
  messageId?: string
): ArtifactData => {
  const list: BasicMessage[] =
    typeof messages === "string"
      ? [{ id: messageId ?? "single", role: "ASSISTANT", content: messages }]
      : messages;

  const blocks: ArtifactBlock[] = [];
  const displayMap: Record<string, string> = {};
  const hasArtifactMap: Record<string, boolean> = {};
  const byId: Record<string, ArtifactBlock> = {};
  let blockIndex = 0;

  list.forEach((message, messageIndex) => {
    if (message.role !== "ASSISTANT") return;
    const content = message.content || "";
    const prompt = resolvePrompt(promptSource, message.id);
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let stripped = "";
    let hasArtifact = false;

    ARTIFACT_FENCE_REGEX.lastIndex = 0;
    while ((match = ARTIFACT_FENCE_REGEX.exec(content))) {
      const full = match[0];
      const code = match[1] ?? "";
      stripped += content.slice(lastIndex, match.index);
      lastIndex = match.index + full.length;
      hasArtifact = true;
      const cleaned = code.trimEnd();
      const block: ArtifactBlock = {
        id: `${message.id}-${blockIndex}`,
        messageId: message.id,
        language: "html",
        title: extractArtifactTitle(cleaned, prompt),
        code: cleaned,
        sourceIndex: messageIndex + 1,
      };
      blocks.push(block);
      byId[block.id] = block;
      blockIndex += 1;
    }

    if (hasArtifact) {
      stripped += content.slice(lastIndex);
      const display = stripped.replace(/\n{3,}/g, "\n\n").trim();
      displayMap[message.id] = display;
      hasArtifactMap[message.id] = true;
    }
  });

  return { blocks, displayMap, hasArtifactMap, byId };
};
