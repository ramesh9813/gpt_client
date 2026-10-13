// File chat helpers — client side.
// 20MB per file, 5 files max. Reads text/code directly; PDFs via pdfjs-dist
// text extraction, audio via on-device Whisper transcription.

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 5;
export const MAX_FILE_NAME_LENGTH = 255;

export type FileAttachment = {
  name: string;
  mime: string;
  size: number;
  content: string;
  // Original bytes for audio/video only (session memory — never serialized
  // or sent). Powers inline playback of sent files via the media store.
  source?: File;
  // Base64 audio payload for the model (audio only): sent to the selected
  // provider directly — no on-device transcription on the file path.
  dataUrl?: string;
};

const AUDIO_EXTS = new Set(["mp3","wav","m4a","ogg","oga","weba","flac","aac","wma","opus","mka","aiff","aif","amr","awb","mid","midi"]);
const VIDEO_EXTS = new Set(["mp4","webm","mov","mkv","avi","3gp","ogv","m4v","wmv","flv","ts","mts","m2ts"]);

export const isAudioFile = (name: string, mime: string): boolean => {
  if (mime.startsWith("audio/")) return true;
  // webm can be audio-only or video — mime decides when present.
  if (mime.startsWith("video/")) return false;
  return AUDIO_EXTS.has(extOf(name));
};

export const isVideoFile = (name: string, mime: string): boolean => {
  if (mime.startsWith("video/")) return true;
  if (mime.startsWith("audio/")) return false;
  return VIDEO_EXTS.has(extOf(name));
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

// Real PDF text extraction via pdfjs-dist (handles compressed/encoded PDFs
// the naive byte-decode below cannot read). Lazy-imported so the pdf chunk
// only loads on first PDF attach. Caps pages for mobile safety.
const extractPdfText = async (buf: ArrayBuffer): Promise<string> => {
  const pdfjs = (await import("pdfjs-dist")) as any;
  if (!pdfjs?.GlobalWorkerOptions?.workerSrc) {
    const workerMod = (await import(
      "pdfjs-dist/build/pdf.worker.min.mjs?url"
    )) as any;
    pdfjs.GlobalWorkerOptions.workerSrc =
      workerMod?.default ?? workerMod;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  try {
    const parts: string[] = [];
    const pages = Math.min(doc.numPages ?? 0, 50);
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      try {
        const tc = await page.getTextContent();
        const line = (tc?.items ?? [])
          .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
          .join(" ");
        if (line.trim()) parts.push(line);
      } finally {
        try {
          page.cleanup?.();
        } catch {}
      }
      if (parts.join("\n").length >= 80_000) break;
    }
    return parts.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
  } finally {
    try {
      await doc.destroy?.();
    } catch {}
  }
};

// File-attached audio is NEVER transcribed here (mic input still uses the
// on-device Whisper pipeline in lib/transcribe): picked audio goes straight
// to the selected model as a base64 payload. Unreadable files yield null so
// the caller keeps a meta-only placeholder with the exact reason.
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
  oga: "audio/ogg", weba: "audio/webm", flac: "audio/flac", aac: "audio/aac",
  wma: "audio/x-ms-wma", opus: "audio/opus", mka: "audio/x-matroska",
  aiff: "audio/aiff", aif: "audio/aiff", amr: "audio/amr", awb: "audio/amr",
  mid: "audio/midi", midi: "audio/midi",
};

const readAudioDataUrl = (file: File, name: string): Promise<string | null> =>
  new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => {
        const v = String(r.result ?? "");
        const m = /^data:([^;,]+)/.exec(v)?.[1] ?? "";
        if (m.startsWith("audio/")) return resolve(v);
        // Picker gave no usable mime (common on Android): relabel from the
        // extension so the model still gets a typed payload.
        const relabel = AUDIO_MIME_BY_EXT[extOf(name)];
        if (relabel && v.startsWith("data:")) {
          return resolve(`data:${relabel}${v.slice(5 + m.length)}`);
        }
        resolve(null);
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    } catch {
      resolve(null);
    }
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

  // Audio: sent STRAIGHT to the selected model as base64 (no Whisper in
  // between) — the model itself analyses and responds. Bytes always kept
  // for inline playback, whatever the format (mime or extension match).
  if (isAudioFile(name, mime)) {
    const dataUrl = await readAudioDataUrl(file, name);
    const kb = Math.round(size / 1024);
    if (!dataUrl) {
      return { name, mime, size, content: `[audio file: ${name} (${mime}, ${kb}KB) — audio could not be read on this device]`, source: file };
    }
    return {
      name,
      mime,
      size,
      content: `[audio file: ${name} (${mime}, ${kb}KB)]`,
      source: file,
      dataUrl,
    };
  }

  // PDF: real text extraction via pdfjs-dist first; naive byte-decode, then
  // meta note, as fallbacks.
  if (mime === "application/pdf" || extOf(name) === "pdf") {
    try {
      const buf = await readAsArrayBuffer(file);
      try {
        const text = await extractPdfText(buf);
        if (text.trim().length >= 24) {
          const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
          return { name, mime, size, content: `[PDF: ${name}]\n${cleaned.slice(0, 80_000)}` };
        }
      } catch {
        // fall through to naive decode below
      }
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

  // Video: keep bytes for inline playback, send only a meta note (the model
  // gets no video frames on this path). Skips the wasteful text decode.
  if (isVideoFile(name, mime)) {
    return { name, mime, size, content: `[video file: ${name} (${mime}, ${Math.round(size / 1024)}KB)]`, source: file };
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
