export const EXTENSION_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  python: "py",
  py: "py",
  java: "java",
  cpp: "cpp",
  c: "c",
  csharp: "cs",
  cs: "cs",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  markdown: "md",
  md: "md",
  yaml: "yaml",
  yml: "yaml",
  dockerfile: "yaml",
  go: "go",
  rust: "go",
  php: "php",
  ruby: "php",
  swift: "rs",
  kotlin: "kt",
  r: "r",
  xml: "xml",
  text: "txt",
  txt: "txt"
};

export const getExtensionForLang = (lang: string) => {
  return EXTENSION_MAP[lang.toLowerCase()] || "txt";
};

export type SimpleMessage = {
  role: string;
  content: string;
  images?: string[];
};

export type CodeBlock = {
  lang: string;
  code: string;
};
