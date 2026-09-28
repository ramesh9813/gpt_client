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

  // Promote inline $...$ that spans a newline and contains block-ish
  // LaTeX (frac, hbar, nabla, left/right, etc.) to display $$...$$.
  // Keeps short inline "$E=mc^2$" untouched.
  out = out.replace(/(?<!\$)\$(?!\$)([\s\S]*?)(?<!\$)\$(?!\$)/g, (full, inner: string) => {
    if (inner.includes("\n") && /\\(frac|hbar|Psi|psi|nabla|mathbf|left|right|partial|sum|int|sqrt)/.test(inner)) {
      const trimmed = inner.trim();
      // Avoid turning a genuinely short inline that was line-wrapped by
      // the streamer into display — require at least one block command.
      if (trimmed.length > 16) return `$$${inner}$$`;
    }
    return full;
  });

  return out;
};

export const MarkdownContent = ({ content }: { content: string }) => {
  const normalized = useMemo(() => normalizeMath(content), [content]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
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
