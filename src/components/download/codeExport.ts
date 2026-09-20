import JSZip from "jszip";
import { getExtensionForLang, type CodeBlock } from "./extensionMap";

export const extractCodeBlocks = (content: string): CodeBlock[] => {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      lang: match[1] || "text",
      code: match[2]
    });
  }
  return blocks;
};

export const resolveCodeFilename = (code: string, fallback: string) => {
  const firstLine = code.trim().split("\n")[0] || "";
  const filenameMatch = firstLine.match(/(?:\/\/|#|--)\s*([\w.-]+\.\w+)/);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  return fallback;
};

export const singleCodeFilename = (block: CodeBlock) => {
  const ext = getExtensionForLang(block.lang);
  return resolveCodeFilename(block.code, `code.${ext}`);
};

export const createSingleCodeBlob = (code: string) => {
  return new Blob([code], { type: "text/plain;charset=utf-8" });
};

const uniqueZipFilename = (zip: JSZip, filename: string) => {
  let finalFilename = filename;
  let counter = 1;
  while (zip.file(finalFilename)) {
    const nameParts = filename.split(".");
    const base = nameParts.slice(0, -1).join(".");
    const extension = nameParts[nameParts.length - 1];
    finalFilename = `${base}_${counter}.${extension}`;
    counter++;
  }
  return finalFilename;
};

export const createCodeZipBlob = async (blocks: CodeBlock[]) => {
  const zip = new JSZip();
  blocks.forEach((block, index) => {
    const ext = getExtensionForLang(block.lang);
    const fallback = `snippet_${index + 1}.${ext}`;
    const filename = resolveCodeFilename(block.code, fallback);
    const finalFilename = uniqueZipFilename(zip, filename);
    zip.file(finalFilename, block.code);
  });
  return zip.generateAsync({ type: "blob" });
};
