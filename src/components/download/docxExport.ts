import { marked } from "marked";
import type { Token, Tokens } from "marked";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  SimpleField,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

// Palette mirrors the app (teal accent, muted gray) in print-friendly hex.
const INK = "1A1A1A";
const MUTED = "6B7280";
const ACCENT = "0F766E";
const LINK_BLUE = "2563EB";
const CODE_BG = "F2F4F7";
const TABLE_HEAD_BG = "E8EDEF";
const GRID = "BFBFBF";

const MONO = "Consolas";
const UI_FONT = "Calibri";

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
};

const styleRun = (
  text: string,
  style: InlineStyle,
  extra?: { color?: string; size?: number }
): TextRun => {
  if (style.code) {
    return new TextRun({
      text,
      font: MONO,
      size: 19,
      color: extra?.color ?? INK,
      shading: { type: ShadingType.CLEAR, fill: CODE_BG },
    });
  }
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    color: extra?.color,
    size: extra?.size,
  });
};

// Recursive inline renderer: bold / italic / strike / code / links / images.
const renderInline = (
  tokens: Token[] | undefined,
  style: InlineStyle = {}
): (TextRun | ExternalHyperlink)[] => {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const tok of tokens ?? []) {
    const t = tok as Tokens.Generic;
    switch (t.type) {
      case "text":
      case "escape": {
        const inner = (t as { tokens?: Token[] }).tokens;
        if (inner && inner.length > 0) out.push(...renderInline(inner, style));
        else if (t.text) out.push(styleRun(t.text, style));
        break;
      }
      case "strong":
        out.push(
          ...renderInline((t as Tokens.Strong).tokens, { ...style, bold: true })
        );
        break;
      case "em":
        out.push(
          ...renderInline((t as Tokens.Em).tokens, { ...style, italics: true })
        );
        break;
      case "del":
        out.push(
          ...renderInline((t as Tokens.Del).tokens, { ...style, strike: true })
        );
        break;
      case "codespan":
        out.push(
          styleRun((t as Tokens.Codespan).text, { ...style, code: true })
        );
        break;
      case "br":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link": {
        const link = t as Tokens.Link;
        const labelRuns = renderInline(link.tokens, style).filter(
          (n): n is TextRun => n instanceof TextRun
        );
        const label =
          labelRuns
            .map((r) => (r as unknown as { text?: string }).text ?? "")
            .join("") || link.href;
        out.push(
          new ExternalHyperlink({
            link: link.href,
            children: [
              new TextRun({ text: label, color: LINK_BLUE, underline: {} }),
            ],
          })
        );
        break;
      }
      case "image": {
        const img = t as Tokens.Image;
        out.push(
          styleRun(`[Image: ${img.text || img.href}]`, style, {
            color: MUTED,
            size: 20,
          })
        );
        break;
      }
      case "html":
        break;
      default:
        if ((t as unknown as { text?: string }).text)
          out.push(styleRun((t as unknown as { text: string }).text, style));
        break;
    }
  }
  return out;
};

const bulletLevels = () =>
  Array.from({ length: 6 }, (_, level) => ({
    level,
    format: LevelFormat.BULLET,
    text: level % 3 === 0 ? "•" : level % 3 === 1 ? "◦" : "▪",
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: { indent: { left: 720 + level * 360, hanging: 360 } },
    },
  }));

const decimalLevels = () =>
  Array.from({ length: 6 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: { indent: { left: 720 + level * 360, hanging: 360 } },
    },
  }));

// Quote chrome: indented with a teal left bar.
const quoteProps = (active: boolean) =>
  active
    ? {
        indent: { left: 720 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT },
        },
      }
    : {};

const renderCodeBlock = (code: Tokens.Code, quote: boolean): Paragraph[] => {
  const rawLang = (code.lang || "text").split(":")[0] || "text";
  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: rawLang, color: MUTED, size: 17, italics: true }),
      ],
      spacing: { before: 160, after: 40 },
      ...quoteProps(quote),
    }),
  ];
  const lines = code.text.replace(/\n$/, "").split("\n");
  lines.forEach((line, i) => {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line.length > 0 ? line : " ",
            font: MONO,
            size: 19,
          }),
        ],
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
        spacing: { before: 0, after: i === lines.length - 1 ? 160 : 0 },
        ...quoteProps(quote),
      })
    );
  });
  return paras;
};

const renderTable = (table: Tokens.Table): Table => {
  const aligns = table.align ?? [];
  const cellAlign = (i: number) => {
    const a = aligns[i];
    if (a === "center") return AlignmentType.CENTER;
    if (a === "right") return AlignmentType.RIGHT;
    return AlignmentType.LEFT;
  };
  const edge = { style: BorderStyle.SINGLE, size: 4, color: GRID };
  const borders = {
    top: edge,
    bottom: edge,
    left: edge,
    right: edge,
    insideH: edge,
    insideV: edge,
  };
  const headCells = table.header.map(
    (cell, i) =>
      new TableCell({
        children: [
          new Paragraph({
            alignment: cellAlign(i),
            children: renderInline(cell.tokens, { bold: true }),
          }),
        ],
        shading: { type: ShadingType.CLEAR, fill: TABLE_HEAD_BG },
      })
  );
  const bodyRows = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell, i) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: cellAlign(i),
                  children: renderInline(cell.tokens),
                }),
              ],
            })
        ),
      })
  );
  return new Table({
    rows: [
      new TableRow({ children: headCells, tableHeader: true }),
      ...bodyRows,
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
  });
};

type BlockOpts = { listLevel?: number; quote?: boolean };

const renderList = (list: Tokens.List, opts: BlockOpts): (Paragraph | Table)[] => {
  const out: (Paragraph | Table)[] = [];
  const ref = list.ordered ? "number-list" : "bullet-list";
  const level = Math.min(opts.listLevel ?? 0, 5);

  for (const rawItem of list.items) {
    const li = rawItem as Tokens.ListItem;
    const taskPrefix = li.task ? (li.checked ? "☑ " : "☐ ") : "";
    let numbered = false;

    for (const sub of li.tokens) {
      const st = sub as Tokens.Generic;
      if (!numbered && (st.type === "text" || st.type === "paragraph")) {
        const inlineToks = (st as { tokens?: Token[] }).tokens;
        const fallback = (st as { text?: string }).text ?? "";
        out.push(
          new Paragraph({
            children: [
              ...(taskPrefix ? [new TextRun({ text: taskPrefix })] : []),
              ...(inlineToks && inlineToks.length > 0
                ? renderInline(inlineToks)
                : [new TextRun({ text: fallback })]),
            ],
            numbering: { reference: ref, level },
            spacing: { after: 40 },
            ...quoteProps(!!opts.quote),
          })
        );
        numbered = true;
      } else {
        // Nested list / code / quote inside the item: one level deeper.
        out.push(...renderBlocks([sub], { listLevel: level + 1, quote: opts.quote }));
      }
    }

    if (!numbered) {
      out.push(
        new Paragraph({
          children: [
            ...(taskPrefix ? [new TextRun({ text: taskPrefix })] : []),
            new TextRun({ text: li.text }),
          ],
          numbering: { reference: ref, level },
          spacing: { after: 40 },
          ...quoteProps(!!opts.quote),
        })
      );
    }
  }
  return out;
};

const renderBlocks = (tokens: Token[], opts: BlockOpts = {}): (Paragraph | Table)[] => {
  const out: (Paragraph | Table)[] = [];
  const quote = !!opts.quote;

  for (const tok of tokens) {
    const t = tok as Tokens.Generic;
    switch (t.type) {
      case "space":
        break;
      case "heading": {
        const h = t as Tokens.Heading;
        const depth = Math.min(Math.max(h.depth, 1), 6);
        const level =
          depth === 1
            ? HeadingLevel.HEADING_1
            : depth === 2
              ? HeadingLevel.HEADING_2
              : depth === 3
                ? HeadingLevel.HEADING_3
                : depth === 4
                  ? HeadingLevel.HEADING_4
                  : depth === 5
                    ? HeadingLevel.HEADING_5
                    : HeadingLevel.HEADING_6;
        out.push(
          new Paragraph({ heading: level, children: renderInline(h.tokens) })
        );
        break;
      }
      case "paragraph": {
        const p = t as Tokens.Paragraph;
        out.push(
          new Paragraph({
            children: renderInline(p.tokens),
            spacing: { after: 160 },
            ...quoteProps(quote),
          })
        );
        break;
      }
      case "text": {
        const tx = t as unknown as { tokens?: Token[]; text: string };
        out.push(
          new Paragraph({
            children:
              tx.tokens && tx.tokens.length > 0
                ? renderInline(tx.tokens)
                : [new TextRun({ text: tx.text })],
            spacing: { after: 160 },
            ...quoteProps(quote),
          })
        );
        break;
      }
      case "code":
        out.push(...renderCodeBlock(t as Tokens.Code, quote));
        break;
      case "blockquote":
        out.push(
          ...renderBlocks((t as Tokens.Blockquote).tokens, { ...opts, quote: true })
        );
        break;
      case "list":
        out.push(...renderList(t as Tokens.List, opts));
        break;
      case "table":
        out.push(renderTable(t as Tokens.Table));
        break;
      case "hr":
        out.push(
          new Paragraph({
            children: [new TextRun({ text: "" })],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: GRID },
            },
            spacing: { before: 160, after: 160 },
          })
        );
        break;
      case "html":
        break;
      default: {
        const maybe = t as { text?: string; tokens?: Token[] };
        if (maybe.tokens && maybe.tokens.length > 0) {
          out.push(...renderBlocks(maybe.tokens, opts));
        } else if (maybe.text) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: maybe.text })],
              spacing: { after: 160 },
              ...quoteProps(quote),
            })
          );
        }
        break;
      }
    }
  }
  return out;
};

// Public API: clean, labeled, paged A4 document from chat markdown.
export const buildDocxBlob = async (
  content: string,
  title = "Chat"
): Promise<Blob> => {
  const tokens = marked.lexer(content || "");
  const body = renderBlocks(tokens);

  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const doc = new Document({
    numbering: {
      config: [
        { reference: "bullet-list", levels: bulletLevels() },
        { reference: "number-list", levels: decimalLevels() },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: UI_FONT, size: 22, color: INK },
          paragraph: { spacing: { after: 160, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: title, bold: true, size: 20 }),
                  new TextRun({
                    text: `   •   ${dateStr}`,
                    color: MUTED,
                    size: 18,
                  }),
                ],
                spacing: { after: 60 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", color: MUTED, size: 18 }),
                  new SimpleField("PAGE", "1"),
                  new TextRun({ text: " of ", color: MUTED, size: 18 }),
                  new SimpleField("NUMPAGES", "1"),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Exported ${dateStr}`,
                color: MUTED,
                size: 20,
                italics: true,
              }),
            ],
            spacing: { after: 320 },
          }),
          ...(body.length > 0
            ? body
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "No content.",
                      color: MUTED,
                      italics: true,
                    }),
                  ],
                }),
              ]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
};
