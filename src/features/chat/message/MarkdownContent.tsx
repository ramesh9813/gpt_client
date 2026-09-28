import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CodeBlockWithRun } from "./CodeBlockWithRun";
import { downloadImageAs } from "../../../lib/image";

const ALLOWED_HREF = /^(https?:\/\/|mailto:|#|\/)/i;
const ALLOWED_IMG_SRC = /^(https?:\/\/|data:image\/(png|jpeg|jpg|gif|webp);base64,|\/)/i;

const sanitizeHref = (href?: string): string | undefined => {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (ALLOWED_HREF.test(trimmed)) return trimmed;
  return undefined;
};

const sanitizeImgSrc = (src?: string): string | undefined => {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (ALLOWED_IMG_SRC.test(trimmed)) return trimmed;
  return undefined;
};

/**
 * Normalize LLM math variants so remark-math can parse them:
 * - \( \) → $ $  and  \[ \] → $$ $$
 * - Multiline single-dollar blocks (LLM often writes
 *   "$ a \\frac... \n \\left[...\\right] $" on two lines) are promoted
 *   to $$ display $$ so KaTeX renders as a centered block instead of
 *   an inline run that overflows/overlaps adjacent text.
 */
const normalizeMath = (s: string): string => {
  let out = s
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$");

  out = out.replace(/(?<!\$)\$(?!\$)([\s\S]*?)(?<!\$)\$(?!\$)/g, (full, inner: string) => {
    if (inner.includes("\n") && /\\(frac|hbar|Psi|psi|nabla|mathbf|left|right|partial|sum|int|sqrt)/.test(inner)) {
      const trimmed = inner.trim();
      if (trimmed.length > 16) return `$$${inner}$$`;
    }
    return full;
  });

  return out;
};

const MarkdownImage = ({ src, alt }: { src: string; alt: string }) => {
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setExpanded(false), []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded, close]);

  return (
    <>
      <span className="msg-md-img-wrap" role="group" aria-label={alt || "Image"}>
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onClick={() => setExpanded(true)} style={{ cursor: "zoom-in" }} />
        <span className="msg-md-img-actions" aria-hidden="false">
          <button type="button" className="msg-md-img-btn" onClick={() => setExpanded(true)} aria-label="Expand image" title="Expand">
            <i className="bi bi-arrows-angle-expand" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="msg-md-img-btn"
            onClick={() => void downloadImageAs(src, "jpg", 0)}
            aria-label="Download JPG"
            title="Download JPG"
          >
            JPG
          </button>
          <button
            type="button"
            className="msg-md-img-btn"
            onClick={() => void downloadImageAs(src, "png", 0)}
            aria-label="Download PNG"
            title="Download PNG"
          >
            PNG
          </button>
        </span>
      </span>
      {expanded && (
        <span className="msg-image-lightbox" role="dialog" aria-modal="true" aria-label="Expanded image" onClick={close} style={{ display: "flex" }}>
          <span className="msg-lightbox-card" role="document" onClick={(e) => e.stopPropagation()}>
            <span className="msg-lightbox-card-head">
              <span className="msg-lightbox-card-title">
                <i className="bi bi-image" aria-hidden="true" /> <span>{alt || "Image"}</span>
              </span>
              <button type="button" className="msg-lightbox-card-close" onClick={close} aria-label="Close" title="Close">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </span>
            <span className="msg-lightbox-card-body">
              <img src={src} alt={alt || "Expanded image"} className="msg-lightbox-card-img" />
            </span>
            <span className="msg-lightbox-card-foot">
              <button type="button" className="msg-lightbox-dl" onClick={() => void downloadImageAs(src, "jpg", 0)} aria-label="Download JPG">
                <i className="bi bi-filetype-jpg" aria-hidden="true" /> Download JPG
              </button>
              <button type="button" className="msg-lightbox-dl msg-lightbox-dl--alt" onClick={() => void downloadImageAs(src, "png", 0)} aria-label="Download PNG">
                <i className="bi bi-filetype-png" aria-hidden="true" /> Download PNG
              </button>
            </span>
          </span>
        </span>
      )}
    </>
  );
};

export const MarkdownContent = ({ content }: { content: string }) => {
  const normalized = useMemo(() => normalizeMath(content), [content]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]] as any}
      components={{
        a(props) {
          const { children, node, ...rest } = props as any;
          const safeHref = sanitizeHref(rest.href);
          if (!safeHref) {
            return <span className="msg-link-blocked">{children}</span>;
          }
          const isExternal = /^https?:\/\//i.test(safeHref);
          return (
            <a
              {...rest}
              href={safeHref}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          );
        },
        img(props) {
          const safeSrc = sanitizeImgSrc(props.src as string | undefined);
          if (!safeSrc) return null;
          const alt = typeof props.alt === "string" ? props.alt : "";
          return <MarkdownImage src={safeSrc} alt={alt} />;
        },
        pre(props) {
          return <div className="msg-md-pre">{props.children}</div>;
        },
        code(props) {
          const { children, className, node, ...rest } = props;
          if (className && /language-math|math-(inline|display)/.test(className)) {
            return (
              <code {...rest} className={className}>
                {children}
              </code>
            );
          }
          const match = /language-(\w+)/.exec(className || "");
          return match ? (
            <CodeBlockWithRun language={match[1]} code={String(children)} />
          ) : (
            <code {...rest} className={className}>
              {children}
            </code>
          );
        }
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
};
