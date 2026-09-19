/**
 * Client-side image compression helper.
 * No new dependencies — uses <canvas> + Image.
 * Returns a JPEG dataURL capped at `maxDim` (long edge) with `quality`.
 */

export const MAX_IMAGE_DIM = 1280;
export const IMAGE_QUALITY = 0.8;
export const MAX_IMAGES_PER_MESSAGE = 3;

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
