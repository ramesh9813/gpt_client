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

/**
 * In-progress artifact: an opening ```html:artifact fence with no closing
 * fence yet (the model is still streaming the HTML). Matched separately so
 * the card + onboard Open button appear immediately — showing the
 * simulation (preview) — instead of raw code while the turn streams.
 * Plain ```html fences are NOT matched here: mid-stream they are
 * indistinguishable from ordinary code snippets (see fallback rule above).
 */
export const UNCLOSED_ARTIFACT_OPENER_REGEX = /```html:artifact[ \t]*\r?\n?/g;

/**
 * Fallback: models often drop the non-standard ":artifact" suffix and emit a
 * plain ```html fence instead (renders as a dead code block otherwise). A
 * plain html fence is claimed as a simulation ONLY when its body is a
 * complete standalone document — doctype (or <html>) plus closing </html>.
 * Snippets/partials stay code (and stay canvas-owned).
 */
export const PLAIN_HTML_FENCE_REGEX = /```html[ \t]*\r?\n([\s\S]*?)```/g;

export const isStandaloneHtmlDocument = (code: string): boolean => {
  if (!code) return false;
  const hasRoot = /<!doctype\s+html|<html[\s>]/i.test(code);
  const hasClose = /<\/html\s*>/i.test(code);
  return hasRoot && hasClose;
};

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

    const claimBlock = (code: string) => {
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
    };

    // Both fence kinds merged in document order. The ":artifact" pass is
    // exact; the fallback pass claims plain ```html fences ONLY when the
    // body is a complete standalone document (doctype/<html> … </html>),
    // and never inside an already-claimed range.
    type Span = {
      start: number;
      end: number;
      code: string;
    };
    const spans: Span[] = [];
    ARTIFACT_FENCE_REGEX.lastIndex = 0;
    while ((match = ARTIFACT_FENCE_REGEX.exec(content))) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        code: match[1] ?? "",
      });
    }
    const overlapsClaimed = (start: number, end: number): boolean =>
      spans.some((s) => start < s.end && end > s.start);
    PLAIN_HTML_FENCE_REGEX.lastIndex = 0;
    while ((match = PLAIN_HTML_FENCE_REGEX.exec(content))) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlapsClaimed(start, end)) continue;
      const code = match[1] ?? "";
      if (!isStandaloneHtmlDocument(code)) continue;
      spans.push({ start, end, code });
    }
    spans.sort((a, b) => a.start - b.start);
    for (const span of spans) {
      stripped += content.slice(lastIndex, span.start);
      lastIndex = span.end;
      hasArtifact = true;
      claimBlock(span.code);
    }

    // Trailing unclosed opener (mid-stream): claim the remainder as a live
    // block so the onboard expand button shows at once. Only when the
    // opener sits after every claimed range (never inside one).
    const lastClaimedEnd = spans.length > 0 ? spans[spans.length - 1].end : -1;
    let lastOpenerStart = -1;
    let lastOpenerEnd = -1;
    UNCLOSED_ARTIFACT_OPENER_REGEX.lastIndex = 0;
    let openerMatch: RegExpExecArray | null;
    while ((openerMatch = UNCLOSED_ARTIFACT_OPENER_REGEX.exec(content))) {
      lastOpenerStart = openerMatch.index;
      lastOpenerEnd = openerMatch.index + openerMatch[0].length;
    }
    if (lastOpenerStart >= 0 && lastOpenerStart >= lastClaimedEnd) {
      const tail = content.slice(lastOpenerEnd);
      stripped += content.slice(lastIndex, lastOpenerStart);
      lastIndex = content.length;
      hasArtifact = true;
      // Empty body (opener just typed): strip the fence from display but
      // claim no block yet — the card appears with the first code chunk.
      if (tail.trim().length > 0) {
        claimBlock(tail);
      }
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
