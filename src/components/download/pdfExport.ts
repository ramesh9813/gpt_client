import { marked } from "marked";
import { PdfBuilder } from "./pdf/blocks";
import { CONTENT_W, INK, MARGIN_X, MUTED } from "./pdf/styles";

// Text-based chat PDF: built from message data (never screenshotted), so
// text can never overlap. Every page gets a header (chat title + date) and
// a footer (Page X of Y). Markdown renders as headings, styled runs, lists,
// shaded code blocks, figures, and grid tables.

export type PdfMessage = {
  role: string;
  content: string;
  images?: string[];
};

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
