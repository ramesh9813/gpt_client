import { marked } from "marked";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  SimpleField,
  TextRun,
} from "docx";
import { bulletLevels, decimalLevels, renderBlocks } from "./blocks";
import { INK, MUTED, UI_FONT } from "./styles";

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
