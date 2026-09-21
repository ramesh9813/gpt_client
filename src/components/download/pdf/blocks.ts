import type { Token, Tokens } from "marked";
import { PdfBuilderBase } from "./builder";
import { decodeEntities, flattenInline, plainCell } from "./inline";
import {
  INK,
  MARGIN_X,
  MUTED,
  PAGE_H,
  PAGE_W,
  RULE,
  TEAL,
} from "./styles";
import { renderPdfTable } from "./tables";

export class PdfBuilder extends PdfBuilderBase {
  writeBlocks(tokens: Token[], indent = 0) {
    const x = MARGIN_X + indent;
    for (const tok of tokens) {
      const t = tok as Tokens.Generic;
      switch (t.type) {
        case "space":
        case "html":
          break;
        case "heading": {
          const h = t as Tokens.Heading;
          this.writeHeading(plainCell(h.tokens) || h.text, h.depth);
          break;
        }
        case "paragraph":
          this.writeRich(flattenInline((t as Tokens.Paragraph).tokens), { x });
          break;
        case "text": {
          const tx = t as unknown as { tokens?: Token[]; text: string };
          this.writeRich(
            tx.tokens && tx.tokens.length > 0
              ? flattenInline(tx.tokens)
              : [{ text: decodeEntities(tx.text) }],
            { x }
          );
          break;
        }
        case "code": {
          const c = t as Tokens.Code;
          const lang = (c.lang || "text").split(":")[0] || "text";
          this.writeCode(c.text.replace(/\n$/, "").split("\n"), lang);
          break;
        }
        case "blockquote": {
          const y0 = this.y;
          this.writeBlocks((t as Tokens.Blockquote).tokens, indent + 8);
          // Teal sidebar spanning the quoted block.
          this.doc.setFillColor(...TEAL);
          this.doc.rect(x + 2, y0, 0.8, Math.max(1, this.y - y0), "F");
          this.y += 1.5;
          break;
        }
        case "list": {
          const list = t as Tokens.List;
          let n = Number(list.start) || 1;
          for (const rawItem of list.items) {
            const li = rawItem as Tokens.ListItem;
            const marker = list.ordered
              ? `${n++}. `
              : li.task
                ? li.checked
                  ? "☑ "
                  : "☐ "
                : "• ";
            const first = li.tokens[0] as Tokens.Generic | undefined;
            const inlineToks =
              first && (first.type === "text" || first.type === "paragraph")
                ? (first as { tokens?: Token[] }).tokens ?? []
                : [];
            this.writeRich(
              [
                { text: marker, bold: true },
                ...flattenInline(inlineToks.length > 0 ? inlineToks : undefined),
                ...(inlineToks.length === 0 && li.text
                  ? [{ text: decodeEntities(li.text) }]
                  : []),
              ],
              { x: x + 4, after: 1.2 }
            );
            const rest = li.tokens.slice(
              first && (first.type === "text" || first.type === "paragraph") ? 1 : 0
            );
            if (rest.length > 0) this.writeBlocks(rest, indent + 8);
          }
          this.y += 1.5;
          break;
        }
        case "table": {
          const table = t as Tokens.Table;
          renderPdfTable(this, table);
          break;
        }
        case "hr":
          this.rule();
          break;
        default: {
          const maybe = t as unknown as { text?: string; tokens?: Token[] };
          if (maybe.tokens && maybe.tokens.length > 0) {
            this.writeRich(flattenInline(maybe.tokens), { x });
          } else if (maybe.text) {
            this.writeRich([{ text: decodeEntities(maybe.text) }], { x });
          }
          break;
        }
      }
    }
  }

  finish(title: string, filename: string) {
    const dateStr = new Date().toLocaleString();
    const headTitle = title.slice(0, 80) || "Chat";
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      // Header: chat title left, export date right, hairline below.
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(...INK);
      this.doc.text(headTitle, MARGIN_X, 10);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(dateStr, PAGE_W - MARGIN_X, 10, { align: "right" });
      this.doc.setDrawColor(...RULE);
      this.doc.line(MARGIN_X, 13, PAGE_W - MARGIN_X, 13);
      // Footer: hairline above, centered page number.
      this.doc.setDrawColor(...RULE);
      this.doc.line(MARGIN_X, PAGE_H - 11, PAGE_W - MARGIN_X, PAGE_H - 11);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(`Page ${i} of ${total}`, PAGE_W / 2, PAGE_H - 6, {
        align: "center",
      });
    }
    this.doc.save(filename);
  }
}
