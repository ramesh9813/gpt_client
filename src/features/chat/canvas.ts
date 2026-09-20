export type CanvasBlock = {
  id: string;
  messageId: string;
  language: string;
  code: string;
  sourceIndex: number;
};

type BasicMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

// Artifact fences (```html:artifact) must NEVER be treated as canvas code.
// The negative lookahead below excludes any language tag followed by
// ":artifact" (e.g. "html" in "```html:artifact"), so the canvas panel can
// never steal artifact blocks. A defensive skip in the loop below keeps the
// exclusion even if this regex is ever broadened.
const CODE_BLOCK_REGEX = /```((?![a-zA-Z0-9_-]*:artifact)[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;

// Fast prefix check for the defensive skip (covers ```html:artifact plus any
// future "<lang>:artifact" fence variants).
const ARTIFACT_FENCE_PREFIX_REGEX = /```[a-zA-Z0-9_-]*:artifact/;

export const buildCanvasData = (messages: BasicMessage[]) => {
  const blocks: CanvasBlock[] = [];
  const displayMap: Record<string, string> = {};
  const hasCodeMap: Record<string, boolean> = {};
  let blockIndex = 0;

  messages.forEach((message, messageIndex) => {
    if (message.role !== "ASSISTANT") return;
    const content = message.content || "";
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let stripped = "";
    let hasCode = false;

    CODE_BLOCK_REGEX.lastIndex = 0;
    while ((match = CODE_BLOCK_REGEX.exec(content))) {
      const [full, lang, code] = match;
      // Defensive: never steal artifact fences. Keep the raw fence in the
      // stripped display so the artifact layer can strip it downstream.
      if (ARTIFACT_FENCE_PREFIX_REGEX.test(full.slice(0, 64))) {
        stripped += content.slice(lastIndex, match.index + full.length);
        lastIndex = match.index + full.length;
        continue;
      }
      stripped += content.slice(lastIndex, match.index);
      lastIndex = match.index + full.length;
      hasCode = true;
      blocks.push({
        id: `${message.id}-${blockIndex}`,
        messageId: message.id,
        language: (lang || "text").toLowerCase(),
        code: code.trimEnd(),
        sourceIndex: messageIndex + 1
      });
      blockIndex += 1;
    }

    if (hasCode) {
      stripped += content.slice(lastIndex);
      const display = stripped.replace(/\n{3,}/g, "\n\n").trim();
      displayMap[message.id] = display;
      hasCodeMap[message.id] = true;
    }
  });

  return { blocks, displayMap, hasCodeMap };
};
