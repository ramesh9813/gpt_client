import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { marked } from "marked";
import type { Token, Tokens } from "marked";

// Text-based chat PDF: built from message data (never screenshotted), so
// text can never overlap. Every page gets a header (chat title + date) and
// a footer (Page X of Y). Markdown renders as headings, styled runs, lists,
// shaded code blocks, figures, and grid tables.

export type PdfMessage = {
  role: string;
  content: string;
  images?: string[];
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;
const HEADER_H = 20;
const FOOTER_H = 15;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [107, 114, 128];
const TEAL: [number, number, number] = [15, 118, 110];
const LINK: [number, number, number] = [37, 99, 235];
const CODE_BG: [number, number, number] = [242, 244, 247];
const RULE: [number, number, number] = [220, 220, 220];

const PT = 0.3528; // mm per typographic point

type Seg = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
  link?: boolean;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

const flattenInline = (
  tokens: Token[] | undefined,
  style: Omit<Seg, "text"> = {}
): Seg[] => {
  const out: Seg[] = [];
  for (const tok of tokens ?? []) {
    const t = tok as Tokens.Generic;
    switch (t.type) {
      case "text":
      case "escape": {
        const inner = (t as { tokens?: Token[] }).tokens;
        if (inner && inner.length > 0) out.push(...flattenInline(inner, style));
        else if (t.text) out.push({ text: decodeEntities(t.text), ...style });
        break;
      }
      case "strong":
        out.push(
          ...flattenInline((t as Tokens.Strong).tokens, { ...style, bold: true })
        );
        break;
      case "em":
        out.push(
          ...flattenInline((t as Tokens.Em).tokens, { ...style, italic: true })
        );
        break;
      case "del":
        out.push(...flattenInline((t as Tokens.Del).tokens, style));
        break;
      case "codespan":
        out.push({
          text: decodeEntities((t as Tokens.Codespan).text),
          ...style,
          mono: true,
        });
        break;
      case "br":
        out.push({ text: "\n" });
        break;
      case "link": {
        const link = t as Tokens.Link;
        const label =
          flattenInline(link.tokens, style)
            .map((s) => s.text)
            .join("") || link.href;
        out.push({ text: decodeEntities(label), ...style, link: true });
        break;
      }
      case "image": {
        const img = t as Tokens.Image;
        out.push({ text: `[Image: ${img.text || img.href}]`, ...style });
        break;
      }
      case "html":
        break;
      default: {
        const maybe = t as unknown as { text?: string };
        if (maybe.text) out.push({ text: decodeEntities(maybe.text), ...style });
        break;
      }
    }
  }
  return out;
};

const plainCell = (tokens: Token[] | undefined): string =>
  flattenInline(tokens)
    .map((s) => s.text)
    .join("")
    .replace(/\n+/g, " ");

class PdfBuilder {
  doc: jsPDF;
  y: number;

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    this.y = HEADER_H + 4;
  }

  ensure(h: number) {
    if (this.y + h > PAGE_H - FOOTER_H) {
      this.doc.addPage();
      this.y = HEADER_H + 4;
    }
  }

  gap(h: number) {
    this.y += h;
  }

  rule() {
    this.ensure(4);
    this.doc.setDrawColor(...RULE);
    this.doc.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y);
    this.y += 4;
  }

  private applySeg(seg: Seg, size: number) {
    const { doc } = this;
    doc.setFont(
      seg.mono ? "courier" : "helvetica",
      seg.bold && seg.italic
        ? "bolditalic"
        : seg.bold
          ? "bold"
          : seg.italic
            ? "italic"
            : "normal"
    );
    doc.setFontSize(size);
    doc.setTextColor(...(seg.link ? LINK : seg.mono ? INK : INK));
    if (seg.mono) doc.setTextColor(...INK);
  }

  // Greedy mixed-style word wrap. Words keep their own bold/italic/mono.
  writeRich(
    segs: Seg[],
    opts: {
      x?: number;
      size?: number;
      color?: [number, number, number];
      lineGap?: number;
      after?: number;
    } = {}
  ) {
    const { doc } = this;
    const x0 = opts.x ?? MARGIN_X;
    const maxX = PAGE_W - MARGIN_X;
    const size = opts.size ?? 10.5;
    const lineH = size * PT * 1.45;
    // Split into words, keeping whitespace runs for faithful spacing.
    const words: Seg[] = [];
    for (const s of segs) {
      const parts = s.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) {
          if (p.includes("\n")) words.push({ text: "\n" });
          else words.push({ text: " " });
        } else {
          words.push({ text: p, bold: s.bold, italic: s.italic, mono: s.mono, link: s.link });
        }
      }
    }
    this.ensure(lineH);
    let cx = x0;
    let lineHasContent = false;
    const newLine = () => {
      this.y += lineH + (opts.lineGap ?? 0);
      this.ensure(lineH);
      cx = x0;
      lineHasContent = false;
    };
    for (const w of words) {
      if (w.text === "\n") {
        newLine();
        continue;
      }
      this.applySeg(w, size);
      if (opts.color && !w.link && !w.mono) doc.setTextColor(...opts.color);
      if (w.mono) doc.setFillColor(...CODE_BG);
      const ww = doc.getTextWidth(w.text === " " ? " " : w.text);
      if (w.text !== " " && cx + ww > maxX + 0.01 && lineHasContent) newLine();
      if (w.text === " ") {
        if (lineHasContent) {
          if (cx + ww <= maxX + 0.01) cx += ww;
        }
        continue;
      }
      if (w.mono) {
        doc.rect(cx, this.y - size * PT * 0.85, ww, size * PT * 1.1, "F");
      }
      doc.text(w.text, cx, this.y);
      cx += ww;
      lineHasContent = true;
    }
    if (lineHasContent) this.y += lineH;
    this.y += opts.after ?? 2.5;
  }

  writeCode(lines: string[], lang: string) {
    const { doc } = this;
    this.ensure(8);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(lang, MARGIN_X, this.y);
    this.y += 4.5;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    const lineH = 9 * PT * 1.5;
    for (const raw of lines) {
      const wrapped = doc.splitTextToSize(raw.length ? raw : " ", CONTENT_W - 4);
      for (const wl of wrapped as string[]) {
        this.ensure(lineH + 0.6);
        doc.setFillColor(...CODE_BG);
        doc.rect(MARGIN_X, this.y - 3.4, CONTENT_W, lineH + 0.4, "F");
        doc.setTextColor(...INK);
        doc.text(wl, MARGIN_X + 2, this.y);
        this.y += lineH;
      }
    }
    this.y += 2.5;
  }

  writeImage(dataUrl: string) {
    const m = /^data:image\/(jpeg|jpg|png);base64,/.exec(dataUrl);
    if (!m) {
      this.writeRich([{ text: "[Attached image: preview not supported in PDF]" }], {
        size: 9,
        color: MUTED,
      });
      return;
    }
    try {
      const props = this.doc.getImageProperties(dataUrl);
      const w = Math.min(CONTENT_W, 150);
      const h = (w * props.height) / Math.max(1, props.width);
      this.ensure(h + 2);
      this.doc.addImage(
        dataUrl,
        m[1] === "png" ? "PNG" : "JPEG",
        MARGIN_X,
        this.y,
        w,
        h
      );
      this.y += h + 2.5;
    } catch {
      // Corrupt payload: keep the layout, note the skip.
      this.writeRich([{ text: "[Attached image could not be embedded]" }], {
        size: 9,
        color: MUTED,
      });
    }
  }

  writeHeading(text: string, depth: number) {
    const size = depth === 1 ? 16 : depth === 2 ? 13.5 : 12;
    this.ensure(size * PT * 1.6 + 2);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...INK);
    const lines = this.doc.splitTextToSize(text, CONTENT_W);
    for (const ln of lines as string[]) {
      this.ensure(size * PT * 1.6);
      this.doc.text(ln, MARGIN_X, this.y);
      this.y += size * PT * 1.6;
    }
    this.y += 2;
  }

  writeRoleLabel(label: string) {
    this.ensure(7);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TEAL);
    this.doc.text(label, MARGIN_X, this.y);
    this.y += 5.5;
  }

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
          autoTable(this.doc, {
            startY: this.y,
            head: [table.header.map((c) => plainCell(c.tokens))],
            body: table.rows.map((row) =>
              row.map((c) => plainCell(c.tokens))
            ),
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
            this.doc as unknown as {
              getLastAutoTable?: () => { finalY?: number } | null;
            }
          ).getLastAutoTable?.();
          const finalY = lastTable?.finalY;
          this.y = (typeof finalY === "number" ? finalY : this.y + 10) + 3;
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

const roleLabel = (role: string): string => {
  const r = (role || "").toUpperCase();
  if (r === "USER") return "You";
  if (r === "SYSTEM") return "System";
  return "Assistant";
};

// Clean, paged, labeled PDF from chat messages. Text-based: overlap-free,
// selectable, with header/footer/page numbers on every page.
export const saveChatElementAsPdf = async (
  messages: PdfMessage[],
  filename = "chat-history.pdf",
  title = "Chat"
): Promise<void> => {
  const pdf = new PdfBuilder();
  const cleanTitle = title.slice(0, 80) || "Chat";

  // Cover title block on page one.
  pdf.doc.setFont("helvetica", "bold");
  pdf.doc.setFontSize(20);
  pdf.doc.setTextColor(...INK);
  const titleLines = pdf.doc.splitTextToSize(cleanTitle, CONTENT_W);
  for (const ln of titleLines as string[]) {
    pdf.ensure(9);
    pdf.doc.text(ln, MARGIN_X, pdf.y);
    pdf.y += 9;
  }
  pdf.doc.setFont("helvetica", "italic");
  pdf.doc.setFontSize(10);
  pdf.doc.setTextColor(...MUTED);
  pdf.ensure(6);
  pdf.doc.text(
    `Exported ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}  •  ${messages.length} message${messages.length === 1 ? "" : "s"}`,
    MARGIN_X,
    pdf.y
  );
  pdf.y += 4;
  pdf.rule();

  if (messages.length === 0) {
    pdf.writeRich([{ text: "No messages in this chat." }]);
  }

  messages.forEach((msg, idx) => {
    if (idx > 0) {
      pdf.gap(2);
      pdf.rule();
    }
    pdf.writeRoleLabel(roleLabel(msg.role));
    for (const img of msg.images ?? []) pdf.writeImage(img);
    const text = (msg.content || "").trim();
    if (text) {
      pdf.writeBlocks(marked.lexer(text));
    } else if (!(msg.images ?? []).length) {
      pdf.writeRich([{ text: "(empty message)" }], { size: 9.5, color: MUTED });
    }
  });

  pdf.finish(cleanTitle, filename);
};
