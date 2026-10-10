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

/**
 * Inline formatting tags models emit (<b>, <i>, <u>, <s>, <code>, <br>)
 * render as literal text (no raw HTML in the pipeline), so convert them to
 * their markdown equivalents. Fenced code blocks and inline code spans are
 * left byte-identical — sample markup there must stay literal.
 */
const convertInlineTags = (text: string): string =>
  text
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<\/?(?:b|strong)(\s[^<>]*)?>/gi, "**")
    .replace(/<\/?(?:i|em)(\s[^<>]*)?>/gi, "*")
    .replace(/<\/?(?:s|del|strike)(\s[^<>]*)?>/gi, "~~")
    .replace(/<\/?u(\s[^<>]*)?>/gi, "**")
    .replace(/<code(\s[^<>]*)?>/gi, "`")
    .replace(/<\/code\s*>/gi, "`");

const normalizeInlineTags = (s: string): string =>
  s
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((chunk, i) =>
      i % 2 === 1
        ? chunk
        : chunk
            .split(/(`[^`\n]*`)/g)
            .map((part, j) => (j % 2 === 1 ? part : convertInlineTags(part)))
            .join("")
    )
    .join("");

/**
 * Hallucinated tool-call tags some models emit on search turns
 * ("<tool_call> <function=web_search>…</function> </tool_call>") are already
 * executed server-side — rendering them is pure noise. Strip closed blocks
 * and a trailing unclosed block (mid-stream), outside fenced code only so
 * real code samples stay literal.
 */
const stripToolCalls = (s: string): string =>
  s
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((chunk, i) =>
      i % 2 === 1
        ? chunk
        : chunk.replace(/<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call\s*>|$)/gi, "")
    )
    .join("");

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
              <button type="button" className="msg-lightbox-card-dl" onClick={() => void downloadImageAs(src, "jpg", 0)} aria-label="Download image" title="Download">
                <i className="bi bi-download" aria-hidden="true" />
              </button>
            </span>
          </span>
        </span>
      )}
    </>
  );
};

const markdownComponents = {
  a(props: any) {
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
  img(props: any) {
    const safeSrc = sanitizeImgSrc(props.src as string | undefined);
    if (!safeSrc) return null;
    const alt = typeof props.alt === "string" ? props.alt : "";
    return <MarkdownImage src={safeSrc} alt={alt} />;
  },
  pre(props: any) {
    return <div className="msg-md-pre">{props.children}</div>;
  },
  code(props: any) {
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
  },
};

const MarkdownBody = ({ content }: { content: string }) => {
  const normalized = useMemo(
    () => normalizeInlineTags(normalizeMath(stripToolCalls(content))),
    [content]
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]] as any}
      components={markdownComponents as any}
    >
      {normalized}
    </ReactMarkdown>
  );
};

/**
 * <details>/<summary> collapsibles: react-markdown escapes raw HTML, so AI
 * answers using details blocks render as literal "<details>" text. Split
 * them out and render real <details> elements instead — summary as plain
 * text (tags stripped, no attributes survive), body as full markdown
 * (recursion handles nesting). Unclosed/malformed tags match nothing and
 * keep the old literal-text behavior.
 */
const DETAILS_RE = /<details\b[^>]*>[\s\S]*?<\/details\s*>/gi;

type DetailsPart = { open: boolean; summary: string; body: string };

const parseDetails = (block: string): DetailsPart | null => {
  const m = block.match(/^<details\b([^>]*)>([\s\S]*?)<\/details\s*>$/i);
  if (!m) return null;
  const open = /\bopen\b/i.test(m[1]);
  const inner = m[2];
  const s = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i);
  const summary =
    (s ? s[1].replace(/<[^<>]*>/g, "") : "").trim() || "Details";
  const body = (s ? inner.replace(s[0], "") : inner).trim();
  return { open, summary, body };
};

type ContentPart = { key: string; text: string; details: DetailsPart | null };

const splitDetails = (content: string): ContentPart[] => {
  DETAILS_RE.lastIndex = 0;
  const out: ContentPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = DETAILS_RE.exec(content)) !== null) {
    if (m.index > last) {
      out.push({ key: `t${i++}`, text: content.slice(last, m.index), details: null });
    }
    const parsed = parseDetails(m[0]);
    out.push({
      key: `d${i++}`,
      text: "",
      details: parsed ?? { open: false, summary: "Details", body: "" },
    });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    out.push({ key: `t${i++}`, text: content.slice(last), details: null });
  }
  return out.length > 0 ? out : [{ key: "t0", text: content, details: null }];
};

export const MarkdownContent = ({ content }: { content: string }) => {
  const parts = useMemo(() => splitDetails(content), [content]);
  // No <details> tags → single markdown part → output identical to before.
  if (parts.length === 1 && !parts[0].details) {
    return <MarkdownBody content={parts[0].text} />;
  }
  return (
    <>
      {parts.map((p) =>
        p.details ? (
          <details
            key={p.key}
            className="msg-details"
            open={p.details.open || undefined}
          >
            <summary className="msg-summary">{p.details.summary}</summary>
            <MarkdownBody content={p.details.body} />
          </details>
        ) : (
          <MarkdownBody key={p.key} content={p.text} />
        )
      )}
    </>
  );
};
