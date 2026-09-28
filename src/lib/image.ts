/**
 * Client-side image helpers.
 * - `compressImageFile` is kept for optional display thumbnails, but the API
 *   payload now preserves full original resolution (lossless base64).
 */
export const MAX_IMAGE_DIM = 1080;
export const IMAGE_QUALITY = 0.80;
export const MAX_IMAGES_PER_MESSAGE = 5;

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image File to a JPEG dataURL.
 * - Scales so longest edge <= maxDim (default 1280px), no upscale.
 * - Draws onto white background (JPEG has no alpha).
 * - Output: data:image/jpeg;base64,...
 */
export async function compressImageFile(
  file: File,
  maxDim: number = MAX_IMAGE_DIM,
  quality: number = IMAGE_QUALITY
): Promise<string> {
  const originalURL = await readAsDataURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(originalURL);
  } catch {
    // If decode fails but it claims to be an image, return original if already a dataURL
    // (caller already filtered by MIME). Re-throw for non-images.
    throw new Error("Unsupported image format");
  }

  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) throw new Error("Invalid image dimensions");

  const scale = Math.min(1, maxDim / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Canvas 2D unavailable — fall back to original dataURL
    return originalURL;
  }

  // JPEG has no transparency → fill white first
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  } catch {
    // older canvas implementations ignore smoothing quality
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Revoke nothing here (object URLs not used); help GC
  img.src = "";

  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Compress a list of Files, skipping non-images.
 * Caps at MAX_IMAGES_PER_MESSAGE.
 */
export async function compressImageList(
  files: FileList | File[],
  maxDim: number = MAX_IMAGE_DIM,
  quality: number = IMAGE_QUALITY
): Promise<string[]> {
  const list = Array.from(files).filter(isImageFile).slice(0, MAX_IMAGES_PER_MESSAGE);
  return Promise.all(list.map((f) => compressImageFile(f, maxDim, quality)));
}

/**
 * Lossless: return the original File as a dataURL without resize or quality
 * loss. Used for the AI API payload so analysis sees full resolution.
 * Falls back to `compressImageFile` only on read failure (never expected).
 */
export async function originalDataURL(file: File): Promise<string> {
  return readAsDataURL(file);
}

export async function originalDataURLList(
  files: FileList | File[]
): Promise<string[]> {
  const list = Array.from(files).filter(isImageFile).slice(0, MAX_IMAGES_PER_MESSAGE);
  return Promise.all(list.map((f) => originalDataURL(f)));
}

/**
 * Download an image `src` (https:// or data:image/...) as JPG or PNG.
 * Tries canvas conversion so the output mime matches `format`; falls back
 * to direct download / open-in-new-tab on CORS taint or error.
 */
export async function downloadImageAs(
  src: string,
  format: "jpg" | "png",
  index: number
): Promise<void> {
  const ext = format === "jpg" ? "jpg" : "png";
  const fileName = `image-${index + 1}.${ext}`;
  const doDirectDownload = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  try {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) (img as HTMLImageElement).crossOrigin = "anonymous";
    (img as any).decoding = "async";
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const w = loaded.naturalWidth || 1024;
    const h = loaded.naturalHeight || 1024;
    const MAX = 1080;
    const scale = Math.min(1, MAX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d");
    if (format === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.drawImage(loaded, 0, 0, cw, ch);
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const dataUrl = canvas.toDataURL(mime, (format === "jpg" ? 0.80 : 0.92) as any);
    doDirectDownload(dataUrl);
  } catch {
    try {
      if (src.startsWith("data:")) {
        doDirectDownload(src);
      } else {
        const res = await fetch(src, { mode: "cors" });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          doDirectDownload(url);
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          return;
        }
        window.open(src, "_blank", "noopener");
      }
    } catch {
      window.open(src, "_blank", "noopener");
    }
  }
}
