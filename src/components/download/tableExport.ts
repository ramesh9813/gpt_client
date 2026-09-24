import JSZip from "jszip";

// A markdown table: array of rows, each row an array of cell strings.
// Row 0 is the header row.
export type MarkdownTable = string[][];

const CODE_FENCE_REGEX = /```[\s\S]*?```/g;

// Split a markdown table row on unescaped pipes, trimming outer pipes.
const splitRow = (line: string): string[] => {
  let text = line.trim();
  // Remove leading/trailing pipe (single outer pair only).
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (ch === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
};

// Delimiter row like `| --- | :---: | ---: |` (at least one --- per cell).
const isDelimiterRow = (cells: string[]): boolean => {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()) && c.trim().length >= 3);
};

// Keep CSV cells readable: strip common inline markdown, keep link text.
const cleanCell = (cell: string): string => {
  let text = cell.trim();
  // [label](url) -> label
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // **bold**, __bold__, *italic*, _italic_, `code`, ~~strike~~
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/~~(.*?)~~/g, "$1");
  text = text.replace(/`([^`]*)`/g, "$1");
  // HTML tags inside cells (e.g. <br>) -> space
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<[^>]*>/g, "");
  // Decode escaped pipe left over
  text = text.replace(/\\\|/g, "|");
  return text.trim();
};

export const extractMarkdownTables = (content: string): MarkdownTable[] => {
  if (!content || !content.includes("|")) return [];
  // Tables never live inside code fences — strip them first so code samples
  // containing pipes can't produce phantom tables.
  const withoutCode = content.replace(CODE_FENCE_REGEX, "");
  const lines = withoutCode.split("\n");
  const tables: MarkdownTable[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.includes("|")) {
      i += 1;
      continue;
    }
    const headerCells = splitRow(line);
    if (headerCells.length < 1) {
      i += 1;
      continue;
    }
    const next = lines[i + 1] ?? "";
    if (!next.includes("|") || !isDelimiterRow(splitRow(next))) {
      i += 1;
      continue;
    }
    // Valid table start: header + delimiter, then 0+ body rows.
    const rows: MarkdownTable = [headerCells.map(cleanCell)];
    i += 2;
    while (i < lines.length) {
      const body = lines[i];
      if (!body.trim() || !body.includes("|")) break;
      // A delimiter-looking line mid-table ends this table.
      const bodyCells = splitRow(body);
      if (isDelimiterRow(bodyCells)) break;
      rows.push(bodyCells.map(cleanCell));
      i += 1;
    }
    // Normalize ragged rows to header width (pad short, trim long).
    const width = rows[0].length;
    const normalized = rows.map((r) => {
      if (r.length === width) return r;
      if (r.length < width) return [...r, ...Array(width - r.length).fill("")];
      return r.slice(0, width);
    });
    tables.push(normalized);
    continue;
  }
  return tables;
};

const escapeCsvCell = (cell: string): string => {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

export const tableToCsv = (table: MarkdownTable): string => {
  // \uFEFF BOM so Excel opens UTF-8 CSVs correctly.
  return `\uFEFF${table.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
};

export const createSingleTableCsvBlob = (table: MarkdownTable): Blob => {
  return new Blob([tableToCsv(table)], { type: "text/csv;charset=utf-8" });
};

export const createTablesZipBlob = async (
  tables: MarkdownTable[],
  base: string
): Promise<Blob> => {
  const zip = new JSZip();
  tables.forEach((table, index) => {
    zip.file(`${base}-table-${index + 1}.csv`, tableToCsv(table));
  });
  return zip.generateAsync({ type: "blob" });
};
