import type { CanvasBlock } from "../canvas";

export const PREVIEW_LANGS = new Set([
  "html",
  "css",
  "js",
  "javascript",
  "jss",
  "web",
  "webdev"
]);

export const RUN_LANGS = new Set([
  "python",
  "py",
  "c",
  "cpp",
  "c++",
  "rust",
  "rs",
  "java"
]);

export const normalizeRunLanguage = (language: string) => {
  const lang = language.toLowerCase();
  if (lang === "py") return "python";
  if (lang === "c++") return "cpp";
  if (lang === "rs") return "rust";
  return lang;
};

export const isPreviewableBlock = (block?: CanvasBlock) => {
  if (!block) return false;
  if (PREVIEW_LANGS.has(block.language)) return true;
  const code = block.code.toLowerCase();
  return code.includes("<html") || code.includes("<body") || code.includes("<div");
};

export const isRunnableBlock = (block?: CanvasBlock) => {
  if (!block) return false;
  return RUN_LANGS.has(block.language);
};

export const buildPreviewDoc = (block: CanvasBlock) => {
  const lang = block.language;
  const code = block.code;
  if (lang === "css") {
    return `<!doctype html>
<html>
  <head>
    <style>
      ${code}
    </style>
  </head>
  <body>
    <div class="preview-root">Preview area</div>
  </body>
</html>`;
  }
  if (lang === "js" || lang === "javascript" || lang === "jss") {
    return `<!doctype html>
<html>
  <head>
    <style>
      body { font-family: sans-serif; padding: 16px; }
    </style>
  </head>
  <body>
    <div id="app">Preview area</div>
    <script>
      ${code}
    </script>
  </body>
</html>`;
  }
  if (lang === "html" || lang === "web" || lang === "webdev") {
    if (code.toLowerCase().includes("<html")) {
      return code;
    }
    return `<!doctype html>
<html>
  <body>
    ${code}
  </body>
</html>`;
  }
  if (code.toLowerCase().includes("<html")) {
    return code;
  }
  return `<!doctype html>
<html>
  <body>
    ${code}
  </body>
</html>`;
};
