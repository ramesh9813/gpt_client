import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const saveChatElementAsPdf = async (
  originalElement: HTMLElement,
  filename = "chat-history.pdf"
) => {
  const clone = originalElement.cloneNode(true) as HTMLElement;

  // Position off-screen but visible for rendering
  // We fix the width to a standard reading width (e.g. 800px) so the text size in PDF is consistent
  const captureWidth = 800;

  clone.style.position = "absolute";
  clone.style.top = "-10000px";
  clone.style.left = "0";
  clone.style.width = `${captureWidth}px`;
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.maxHeight = "none";

  const themeBg = getComputedStyle(document.body).getPropertyValue("--bg") || "#ffffff";
  clone.style.background = themeBg;

  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 1.5, // 1.5x is good balance for A4. 2x is too heavy.
      useCORS: true,
      logging: false,
      backgroundColor: themeBg,
      windowWidth: captureWidth,
      windowHeight: clone.scrollHeight
    });

    // Use JPEG with 0.75 quality - massive size reduction compared to PNG
    const imgData = canvas.toDataURL("image/jpeg", 0.75);

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = 297;

    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let unprintedHeight = imgHeight;
    let top = 0;

    // First page
    pdf.addImage(imgData, "JPEG", 0, top, pdfWidth, imgHeight);
    unprintedHeight -= pdfHeight;

    while (unprintedHeight > 0) {
      top -= pdfHeight; // Move the image up
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, top, pdfWidth, imgHeight);
      unprintedHeight -= pdfHeight;
    }

    pdf.save(filename);
  } finally {
    if (document.body.contains(clone)) {
      document.body.removeChild(clone);
    }
  }
};
