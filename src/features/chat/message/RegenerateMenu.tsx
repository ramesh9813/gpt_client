import { useEffect, useRef, useState } from "react";
import { Dropdown } from "../../../components/Dropdown";
import type { ModelOption } from "./types";

export const RegenerateMenu = ({
  messageId,
  modelOptions,
  onRegenerate
}: {
  messageId: string;
  modelOptions: ModelOption[];
  onRegenerate: (messageId: string, model: string) => void;
}) => {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="msg-regen-wrap" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="msg-icon-btn"
        title="Regenerate response"
        aria-label="Regenerate response"
        type="button"
      >
        <i className="bi bi-arrow-repeat msg-action-icon"></i>
      </button>

      <Dropdown open={open} placement="top" align="start" className="msg-regen-dropdown">
        <div className="msg-regen-list">
          <div className="msg-regen-title">
            Regenerate with...
          </div>
          {modelOptions.map((option) => (
            <button
              key={option.value}
              className="msg-regen-option"
              onClick={() => {
                onRegenerate(messageId, option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Dropdown>
    </div>
  );
};
