import autoTable from "jspdf-autotable";
import type { Tokens } from "marked";
import type { PdfBuilderBase } from "./builder";
import { plainCell } from "./inline";
import { FOOTER_H, HEADER_H, INK, MARGIN_X } from "./styles";

export const renderPdfTable = (
  builder: PdfBuilderBase,
  table: Tokens.Table
): void => {
  autoTable(builder.doc, {
    startY: builder.y,
    head: [table.header.map((c) => plainCell(c.tokens))],
    body: table.rows.map((row) => row.map((c) => plainCell(c.tokens))),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: {
      fillColor: [232, 237, 239],
      textColor: [26, 26, 26],
      fontStyle: "bold",
    },
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: HEADER_H + 2,
      bottom: FOOTER_H + 4,
    },
  });
  const lastTable = (
    builder.doc as unknown as {
      getLastAutoTable?: () => { finalY?: number } | null;
    }
  ).getLastAutoTable?.();
  const finalY = lastTable?.finalY;
  builder.y = (typeof finalY === "number" ? finalY : builder.y + 10) + 3;
};
