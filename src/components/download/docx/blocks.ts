import type { Token, Tokens } from "marked";
import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  LevelFormat,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { renderInline } from "./inline";
import { ACCENT, CODE_BG, GRID, MONO, MUTED, TABLE_HEAD_BG } from "./styles";

export const bulletLevels = () =>
  Array.from({ length: 6 }, (_, level) => ({
    level,
    format: LevelFormat.BULLET,
    text: level % 3 === 0 ? "•" : level % 3 === 1 ? "◦" : "▪",
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: { indent: { left: 720 + level * 360, hanging: 360 } },
    },
  }));

export const decimalLevels = () =>
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
export const quoteProps = (active: boolean) =>
  active
    ? {
        indent: { left: 720 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT },
        },
      }
    : {};

export const renderCodeBlock = (code: Tokens.Code, quote: boolean): Paragraph[] => {
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

export const renderTable = (table: Tokens.Table): Table => {
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

export type BlockOpts = { listLevel?: number; quote?: boolean };

export const renderList = (list: Tokens.List, opts: BlockOpts): (Paragraph | Table)[] => {
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

export const renderBlocks = (tokens: Token[], opts: BlockOpts = {}): (Paragraph | Table)[] => {
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
