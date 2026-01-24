import { useState, useRef, useEffect } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Dropdown } from "./Dropdown";

interface SimpleMessage {
  role: string;
  content: string;
}

interface DownloadMenuProps {
  content: string;
  messages?: SimpleMessage[];
  chatContainerRef?: React.RefObject<HTMLDivElement>;
}

const EXTENSION_MAP: Record<string, string> = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  python: "py",
  py: "py",
  java: "java",
  cpp: "cpp",
  c: "c",
  csharp: "cs",
  cs: "cs",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  markdown: "md",
  md: "md",
  yaml: "yaml",
  yml: "yaml",
  dockerfile: "yaml",
  go: "go",
  rust: "go",
  php: "php",
  ruby: "php",
  swift: "rs",
  kotlin: "kt",
  r: "r",
  xml: "xml",
  text: "txt",
  txt: "txt"
};

export const DownloadMenu = ({ content, messages, chatContainerRef }: DownloadMenuProps) => {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const downloadText = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "response.txt");
    setOpen(false);
  };

  const downloadDocx = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: content.split("\n").map(
            (line) =>
              new Paragraph({
                children: [new TextRun(line)],
              })
          ),
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "response.docx");
    setOpen(false);
  };

  const downloadPdf = async () => {
    if (!chatContainerRef?.current) {
      alert("Chat view not found.");
      return;
    }

    setOpen(false);
    setIsGenerating(true);

    // Small delay to allow React to render the spinner state
    setTimeout(async () => {
      const originalElement = chatContainerRef.current;
      const clone = originalElement.cloneNode(true) as HTMLElement;

      // Position off-screen but visible for rendering
      // We fix the width to a standard reading width (e.g. 800px) so the text size in PDF is consistent
      const captureWidth = 800;
      
      clone.style.position = 'absolute';
      clone.style.top = '-10000px';
      clone.style.left = '0';
      clone.style.width = `${captureWidth}px`;
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      
      const themeBg = getComputedStyle(document.body).getPropertyValue('--bg') || '#ffffff';
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
        const imgData = canvas.toDataURL('image/jpeg', 0.75);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = 210;
        const pdfHeight = 297;
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let unprintedHeight = imgHeight;
        let top = 0;
        
        // First page
        pdf.addImage(imgData, 'JPEG', 0, top, pdfWidth, imgHeight);
        unprintedHeight -= pdfHeight;
        
        while (unprintedHeight > 0) {
          top -= pdfHeight; // Move the image up
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, top, pdfWidth, imgHeight);
          unprintedHeight -= pdfHeight;
        }

        pdf.save("chat-history.pdf");

      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Failed to generate PDF.");
      } finally {
        if (document.body.contains(clone)) {
          document.body.removeChild(clone);
        }
        setIsGenerating(false);
      }
    }, 100);
  };

  const extractCodeBlocks = () => {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        lang: match[1] || "text",
        code: match[2]
      });
    }
    return blocks;
  };

  const downloadCode = async () => {
    const blocks = extractCodeBlocks();
    if (blocks.length === 0) {
      alert("No code blocks found in this response.");
      setOpen(false);
      return;
    }

    if (blocks.length === 1) {
      const block = blocks[0];
      const ext = EXTENSION_MAP[block.lang.toLowerCase()] || "txt";
      // Try to find a filename in the first line (e.g. // filename.js or # filename.py)
      const firstLine = block.code.trim().split('\n')[0];
      let filename = `code.${ext}`;
      // Simple heuristic for filename comment
      const filenameMatch = firstLine.match(/(?:\/\/|#|--)\s*([\w.-]+\.\w+)/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
      
      const blob = new Blob([block.code], { type: "text/plain;charset=utf-8" });
      saveAs(blob, filename);
    } else {
      const zip = new JSZip();
      blocks.forEach((block, index) => {
        const ext = EXTENSION_MAP[block.lang.toLowerCase()] || "txt";
        let filename = `snippet_${index + 1}.${ext}`;
        
        // Try to find a filename in the first line
        const firstLine = block.code.trim().split('\n')[0];
        const filenameMatch = firstLine.match(/(?:\/\/|#|--)\s*([\w.-]+\.\w+)/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        } else {
           // check previous line before code block for filename pattern "filename:" or similar? 
           // For now, simpler is better. If LLM puts filename in comment, we catch it.
        }
        
        // Handle duplicate filenames in zip
        let finalFilename = filename;
        let counter = 1;
        while (zip.file(finalFilename)) {
            const nameParts = filename.split('.');
            const base = nameParts.slice(0, -1).join('.');
            const extension = nameParts[nameParts.length - 1];
            finalFilename = `${base}_${counter}.${extension}`;
            counter++;
        }

        zip.file(finalFilename, block.code);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "code_snippets.zip");
    }
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onClick={() => !isGenerating && setOpen(!open)}
        className="inline-flex items-center gap-1 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        title="Download response"
        disabled={isGenerating}
      >
        {isGenerating ? (
          <i className="bi bi-arrow-clockwise animate-spin"></i>
        ) : (
          <i className="bi bi-download"></i>
        )}
      </button>

      <Dropdown open={open} placement="top" align="end" className="w-32 z-50">
        <div className="py-1">
          <button
            onClick={downloadText}
            className="w-full text-left px-4 py-2 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] flex items-center gap-2"
          >
            <i className="bi bi-file-text"></i> Text (.txt)
          </button>
          <button
            onClick={downloadDocx}
            className="w-full text-left px-4 py-2 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] flex items-center gap-2"
          >
            <i className="bi bi-file-word"></i> Word (.docx)
          </button>
          <button
            onClick={downloadCode}
            className="w-full text-left px-4 py-2 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] flex items-center gap-2"
          >
            <i className="bi bi-code-slash"></i> Code
          </button>
          {messages && messages.length > 0 && (
            <button
              onClick={downloadPdf}
              className="w-full text-left px-4 py-2 text-xs text-[var(--text)] hover:bg-[var(--sidebar)] flex items-center gap-2"
            >
              <i className="bi bi-file-pdf"></i> Page PDF
            </button>
          )}
        </div>
      </Dropdown>
    </div>
  );
};