import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Paged chat PDF: renders the thread once, slices the capture into A4 content
// boxes (no mid-page re-draw of one tall image, so nothing overlaps), and
// stamps every page with a header (chat title + date) and footer (page X of Y).
export const saveChatElementAsPdf = async (
  originalElement: HTMLElement,
  filename = "chat-history.pdf",
  title?: string
) => {
  const clone = originalElement.cloneNode(true) as HTMLElement;

  // Strip floating chrome that would stamp over the content on every page.
  clone
    .querySelectorAll(".msg-jump-wrap, .chat-header, .msg-typing, .msg-generating")
    .forEach((el) => {
      (el as HTMLElement).style.display = "none";
    });

  // Position off-screen but visible for rendering.
  // Fixed reading width (800px) keeps text size consistent in the PDF.
  const captureWidth = 800;

  clone.style.position = "absolute";
  clone.style.top = "-10000px";
  clone.style.left = "0";
  clone.style.width = `${captureWidth}px`;
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.maxHeight = "none";

  const rawBg =
    getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#ffffff";
  clone.style.background = rawBg;

  document.body.appendChild(clone);

  try {
    // Cap capture scale so very long threads stay under browser canvas limits.
    const fullH = clone.scrollHeight || 800;
    const scale = Math.max(1, Math.min(2, 14000 / fullH));

    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: rawBg,
      windowWidth: captureWidth,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const marginX = 10;
    const headerH = 18;
    const footerH = 14;
    const contentW = pageW - marginX * 2; // 190
    const contentH = pageH - headerH - footerH; // 265

    const pxPerMm = canvas.width / contentW;
    const slicePx = Math.max(1, Math.floor(contentH * pxPerMm));
    const totalSlices = Math.max(1, Math.ceil(canvas.height / slicePx));

    const headTitle =
      (title || filename.replace(/\.pdf$/i, "")).slice(0, 80) || "Chat";
    const dateStr = new Date().toLocaleString();

    for (let i = 0; i < totalSlices; i++) {
      const sy = i * slicePx;
      const sh = Math.min(slicePx, canvas.height - sy);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = rawBg;
      ctx.fillRect(0, 0, slice.width, sh);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      const img = slice.toDataURL("image/jpeg", 0.85);
      const hMm = sh / pxPerMm;

      if (i > 0) pdf.addPage();

      // Header: chat title left, date right, hairline below.
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text(headTitle, marginX, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(dateStr, pageW - marginX, 10, { align: "right" });
      pdf.setDrawColor(220, 220, 220);
      pdf.line(marginX, 13, pageW - marginX, 13);

      // Content slice for this page only — never re-drawn, never overlapped.
      pdf.addImage(img, "JPEG", marginX, headerH, contentW, hMm);

      // Footer: hairline above + centered page number.
      pdf.setDrawColor(220, 220, 220);
      pdf.line(marginX, pageH - 11, pageW - marginX, pageH - 11);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Page ${i + 1} of ${totalSlices}`, pageW / 2, pageH - 6, {
        align: "center",
      });
    }

    pdf.save(filename);
  } finally {
    if (document.body.contains(clone)) {
      document.body.removeChild(clone);
    }
  }
};
