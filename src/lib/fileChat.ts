// File chat helpers — client side.
// 20MB per file, 5 files max. Reads text/code directly; binary (pdf/audio)
// is summarized so every pick still chats without breaking.

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_FILE_NAME_LENGTH = 255;

export type FileAttachment = {
  name: string;
  mime: string;
  size: number;
  content: string;
};

const TEXT_EXTS = new Set([
  "txt","md","markdown","json","js","jsx","ts","tsx","mjs","cjs",
  "py","pyw","java","c","h","cpp","hpp","cc","rs","go","rb","php",
  "html","htm","css","scss","less","sh","bash","zsh","yml","yaml",
  "xml","toml","ini","cfg","conf","sql","log","csv","tsv","env",
  "dockerfile","makefile","gradle","properties","graphql","gql","svelte","vue",
]);

const extOf = (name: string): string => {
  const base = name.split("/").pop() || name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
};

const isTextLike = (file: File): boolean => {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml" || file.type === "application/javascript" || file.type === "application/x-sh") return true;
  const ext = extOf(file.name);
  if (TEXT_EXTS.has(ext)) return true;
  if (file.name.toLowerCase() === "dockerfile" || file.name.toLowerCase() === "makefile") return true;
  return false;
};

const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsText(file);
  });

const readAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsArrayBuffer(file);
  });

// Heuristic: >10% replacement chars or >5% NUL => binary
const looksBinary = (s: string): boolean => {
  if (s.includes("\u0000")) return true;
  let rep = 0;
  for (let i = 0; i < Math.min(s.length, 8000); i++) if (s.charCodeAt(i) === 0xfffd) rep++;
  return rep > 800;
};

export const readFileAttachment = async (file: File): Promise<FileAttachment> => {
  const name = file.name || "file";
  const mime = file.type || "application/octet-stream";
  const size = file.size;

  if (size > MAX_FILE_SIZE) throw new Error(`"${name}" exceeds 20MB`);
  if (name.length > MAX_FILE_NAME_LENGTH) throw new Error("Filename too long");

  // Audio: keep as meta-only — no transcription here.
  if (mime.startsWith("audio/") || ["mp3","wav","m4a","ogg","flac","aac","wma","opus"].includes(extOf(name))) {
    return { name, mime, size, content: `[audio file: ${name} (${mime}, ${Math.round(size / 1024)}KB) — audio content not transcribed; describe what you need about it]` };
  }

  // PDF: try text decode; fall back to meta note
  if (mime === "application/pdf" || extOf(name) === "pdf") {
    try {
      const buf = await readAsArrayBuffer(file);
      const dec = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      // Naive: extract strings between parentheses / after Tj — good enough for chat context
      // If mostly binary, keep short placeholder.
      if (looksBinary(dec) || dec.trim().length < 24) {
        return { name, mime, size, content: `[PDF: ${name} (${Math.round(size / 1024)}KB) — binary PDF, text could not be extracted here; ask about the document and include key excerpts if needed]` };
      }
      // Strip nulls/control, keep first 80k
      const cleaned = dec.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
      return { name, mime, size, content: cleaned.slice(0, 80_000) };
    } catch {
      return { name, mime, size, content: `[PDF: ${name} (${Math.round(size / 1024)}KB)]` };
    }
  }

  // Text/code: direct read
  if (isTextLike(file)) {
    const text = await readAsText(file);
    if (looksBinary(text)) {
      return { name, mime, size, content: `[file: ${name} (${mime}) — binary content]` };
    }
    return { name, mime, size, content: text.slice(0, 80_000) };
  }

  // Unknown: try text decode, else meta
  try {
    const text = await readAsText(file);
    if (!text.trim() || looksBinary(text)) {
      return { name, mime, size, content: `[file: ${name} (${mime}, ${Math.round(size / 1024)}KB)]` };
    }
    return { name, mime, size, content: text.slice(0, 80_000) };
  } catch {
    return { name, mime, size, content: `[file: ${name} (${mime}, ${Math.round(size / 1024)}KB)]` };
  }
};

export const fileIcon = (name: string, mime: string): string => {
  const ext = extOf(name);
  if (mime.startsWith("audio/") || ["mp3","wav","m4a","ogg","flac"].includes(ext)) return "bi-file-music";
  if (ext === "pdf" || mime === "application/pdf") return "bi-file-earmark-pdf";
  if (["py","js","ts","jsx","tsx","java","c","cpp","rs","go","rb","php"].includes(ext)) return "bi-file-earmark-code";
  if (["json","xml","yml","yaml","toml","csv"].includes(ext)) return "bi-file-earmark-text";
  return "bi-file-earmark";
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
};
