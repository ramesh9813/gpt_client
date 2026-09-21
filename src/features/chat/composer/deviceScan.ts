import type { DeviceFolderKind, DirEntry, DirHandle } from "./deviceDb";

export const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
export const MAX_SCAN_FILES = 250;
export const MAX_ROW_IMAGES = 10;

export type Found = { file: File; path: string; kind: DeviceFolderKind };

// values() → entries() → async-iterator fallback: implementations differ.
export async function* iterateEntries(dir: DirHandle): AsyncGenerator<DirEntry> {
  if (typeof dir.values === "function") {
    for await (const entry of dir.values()) yield entry;
    return;
  }
  if (typeof dir.entries === "function") {
    for await (const [, handle] of dir.entries()) yield handle;
    return;
  }
  const iterable = dir as unknown as {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<[string, DirEntry]>;
  };
  if (typeof iterable[Symbol.asyncIterator] === "function") {
    for await (const [, handle] of iterable[Symbol.asyncIterator]?.() ?? []) yield handle;
  }
}

export const walkDir = async (
  dir: DirHandle,
  kind: DeviceFolderKind,
  prefix: string,
  out: Found[],
  budget: { n: number },
  depth: number
): Promise<void> => {
  if (depth > 3 || budget.n <= 0) return;
  for await (const entry of iterateEntries(dir)) {
    if (budget.n <= 0) return;
    try {
      if (entry.kind === "file" && IMAGE_EXT.test(entry.name)) {
        const file = await entry.getFile?.();
        if (file) {
          out.push({ file, path: `${prefix}/${entry.name}`, kind });
          budget.n -= 1;
        }
      } else if (
        entry.kind === "directory" &&
        depth < 3 &&
        !entry.name.startsWith(".")
      ) {
        await walkDir(entry as unknown as DirHandle, kind, `${prefix}/${entry.name}`, out, budget, depth + 1);
      }
    } catch {
      // unreadable entry — skip it
    }
  }
};

// Row rule: the screenshots-folder pick always lands in the screenshots row;
// everywhere else, screenshot-like paths do. Both rows stay newest-first.
export const isScreenshotFound = (f: Found): boolean =>
  f.kind === "screenshots" || /screenshot/i.test(f.path);
