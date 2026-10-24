import { describe, expect, it } from "vitest";
import { codeLanguageOf, fileIcon, formatFileSize, isPdfFile, isTextFile } from "../src/lib/fileChat";

describe("isTextFile", () => {
  it("accepts text mimes, code extensions and Dockerfile by name", () => {
    expect(isTextFile("notes.txt", "text/plain")).toBe(true);
    expect(isTextFile("app.ts", "application/octet-stream")).toBe(true);
    expect(isTextFile("Dockerfile", "application/octet-stream")).toBe(true);
    expect(isTextFile("config.yml", "")).toBe(true);
  });

  it("rejects non-text types", () => {
    expect(isTextFile("archive.zip", "application/zip")).toBe(false);
    expect(isTextFile("photo.jpg", "image/jpeg")).toBe(false);
    expect(isTextFile("movie.mp4", "video/mp4")).toBe(false);
  });
});

describe("isPdfFile", () => {
  it("matches by mime and by extension", () => {
    expect(isPdfFile("doc.pdf", "application/octet-stream")).toBe(true);
    expect(isPdfFile("doc.bin", "application/pdf")).toBe(true);
    expect(isPdfFile("doc.txt", "text/plain")).toBe(false);
  });
});

describe("codeLanguageOf", () => {
  it("maps common extensions to prism languages", () => {
    expect(codeLanguageOf("index.tsx")).toBe("typescript");
    expect(codeLanguageOf("main.py")).toBe("python");
    expect(codeLanguageOf("Dockerfile")).toBe("docker");
    expect(codeLanguageOf("styles.scss")).toBe("scss");
  });

  it("returns empty string for plain text", () => {
    expect(codeLanguageOf("readme.txt")).toBe("");
    expect(codeLanguageOf("notes.log")).toBe("");
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("fileIcon", () => {
  it("picks a sensible bootstrap icon per type", () => {
    expect(fileIcon("doc.pdf", "application/pdf")).toBe("bi-file-earmark-pdf");
    expect(fileIcon("song.mp3", "audio/mpeg")).toBe("bi-file-music");
    expect(fileIcon("app.ts", "text/plain")).toBe("bi-file-earmark-code");
    expect(fileIcon("data.json", "application/json")).toBe("bi-file-earmark-text");
    expect(fileIcon("thing.zip", "application/zip")).toBe("bi-file-earmark");
  });
});
