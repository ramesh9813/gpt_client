import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { CodeBlockWithRun } from "./CodeBlockWithRun";

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

/** Normalize common LLM variants: \( \) and \[ \] → $ / $$ for remark-math. */
const normalizeMath = (s: string) =>
  s
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$");

export const MarkdownContent = ({ content }: { content: string }) => {
  const normalized = useMemo(() => normalizeMath(content), [content]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]] as any}
      components={{
        // Citations (incl. web-search sources) open in a new tab.
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
          return <img src={safeSrc} alt={alt} loading="lazy" referrerPolicy="no-referrer" />;
        },
        pre(props) {
          return <div className="msg-md-pre">{props.children}</div>;
        },
        code(props) {
          const { children, className, node, ...rest } = props;
          // KaTeX math is already rendered by rehype-katex — don't turn it into a code block.
          if (className && /language-math|math-(inline|display)/.test(className)) {
            return (
              <code {...rest} className={className}>
                {children}
              </code>
            );
          }
          const match = /language-(\w+)/.exec(className || "");
          return match ? (
            <CodeBlockWithRun
              language={match[1]}
              code={String(children)}
            />
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
