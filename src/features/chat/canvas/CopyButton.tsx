import { useState } from "react";

export const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="canvas-copy-btn"
      title="Copy code"
      type="button"
    >
      <i className={`bi ${copied ? "bi-check" : "bi-clipboard"}`}></i>
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

export default CopyButton;
