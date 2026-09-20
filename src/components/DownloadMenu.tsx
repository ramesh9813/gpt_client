import { useState, useRef, useEffect } from "react";
import { saveAs } from "file-saver";
import { Dropdown } from "./Dropdown";
import "./DownloadMenu.css";
import type { SimpleMessage } from "./download/extensionMap";
import {
  extractCodeBlocks,
  singleCodeFilename,
  createSingleCodeBlob,
  createCodeZipBlob,
} from "./download/codeExport";
import { buildDocxBlob } from "./download/docxExport";
import { saveChatElementAsPdf } from "./download/pdfExport";

interface DownloadMenuProps {
  content: string;
  messages?: SimpleMessage[];
  chatContainerRef?: React.RefObject<HTMLDivElement>;
}

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
    const blob = await buildDocxBlob(content);
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
      const originalElement = chatContainerRef?.current;
      if (!originalElement) {
        setIsGenerating(false);
        return;
      }
      try {
        await saveChatElementAsPdf(originalElement);
      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Failed to generate PDF.");
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const downloadCode = async () => {
    const blocks = extractCodeBlocks(content);
    if (blocks.length === 0) {
      alert("No code blocks found in this response.");
      setOpen(false);
      return;
    }

    if (blocks.length === 1) {
      const block = blocks[0];
      const filename = singleCodeFilename(block);
      const blob = createSingleCodeBlob(block.code);
      saveAs(blob, filename);
    } else {
      const blob = await createCodeZipBlob(blocks);
      saveAs(blob, "code_snippets.zip");
    }
    setOpen(false);
  };

  return (
    <div className="download-menu" ref={containerRef}>
      <button
        onClick={() => !isGenerating && setOpen(!open)}
        className="download-menu-trigger"
        title="Download response"
        aria-label="Download response"
        disabled={isGenerating}
        type="button"
      >
        {isGenerating ? (
          <i className="bi bi-arrow-clockwise download-menu-icon-spin"></i>
        ) : (
          <i className="bi bi-download download-menu-icon"></i>
        )}
      </button>

      <Dropdown open={open} placement="top" align="end" className="download-menu-dropdown">
        <div className="download-menu-list">
          <button
            onClick={downloadText}
            className="download-menu-item"
          >
            <i className="bi bi-file-text download-menu-item-icon download-menu-item-icon-muted"></i> Text (.txt)
          </button>
          <button
            onClick={downloadDocx}
            className="download-menu-item"
          >
            <i className="bi bi-file-word download-menu-item-icon download-menu-item-icon-word"></i> Word (.docx)
          </button>
          <button
            onClick={downloadCode}
            className="download-menu-item"
          >
            <i className="bi bi-file-code download-menu-item-icon download-menu-item-icon-code"></i> Code
          </button>
          {messages && messages.length > 0 && (
            <button
              onClick={downloadPdf}
              className="download-menu-item"
            >
              <i className="bi bi-file-pdf download-menu-item-icon download-menu-item-icon-pdf"></i> Page PDF
            </button>
          )}
        </div>
      </Dropdown>
    </div>
  );
};
