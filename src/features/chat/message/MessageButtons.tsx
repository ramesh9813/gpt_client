import { useState } from "react";

export const CopyButton = ({
  text,
  className,
  showText = true
}: {
  text: string;
  className?: string;
  showText?: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={
        className ||
        "msg-icon-btn"
      }
      title={copied ? "Copied!" : "Copy"}
      aria-label="Copy"
      type="button"
    >
      <i
        className={`bi ${
          copied ? "bi-check2" : "bi-copy"
        } ${copied ? "msg-action-icon--accent" : "msg-action-icon"}`}
      ></i>
      {showText && <span className="msg-copy-label">{copied ? "Copied!" : "Copy"}</span>}
    </button>
  );
};

export const ShareButton = ({
  text,
  title = "ChatGPT Response",
  className
}: {
  text: string;
  title?: string;
  className?: string;
}) => {
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          navigator.clipboard?.writeText(text);
          setShared(true);
          setTimeout(() => setShared(false), 2000);
        }
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={
        className ||
        "msg-icon-btn"
      }
      title={shared ? "Shared!" : "Share response"}
      aria-label="Share response"
      type="button"
    >
      <i
        className={`bi ${
          shared ? "bi-check2" : "bi-share"
        } ${shared ? "msg-action-icon--accent" : "msg-action-icon"}`}
      ></i>
    </button>
  );
};
