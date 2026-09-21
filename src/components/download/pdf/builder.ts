import jsPDF from "jspdf";
import type { Seg } from "./inline";
import {
  CODE_BG,
  CONTENT_W,
  FOOTER_H,
  HEADER_H,
  INK,
  LINK,
  MARGIN_X,
  MUTED,
  PAGE_H,
  PAGE_W,
  PT,
  RULE,
  TEAL,
} from "./styles";

export class PdfBuilderBase {
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
}
