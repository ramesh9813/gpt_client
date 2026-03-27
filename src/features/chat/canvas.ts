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

const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;

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
