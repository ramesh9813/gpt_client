import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlockWithRun } from "./CodeBlockWithRun";

const ALLOWED_HREF = /^(https?:\/\/|mailto:|#|\/)/i;

const sanitizeHref = (href?: string): string | undefined => {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (ALLOWED_HREF.test(trimmed)) return trimmed;
  return undefined;
};

export const MarkdownContent = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
        pre(props) {
          return <div className="msg-md-pre">{props.children}</div>;
        },
        code(props) {
          const { children, className, node, ...rest } = props;
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
      {content}
    </ReactMarkdown>
  );
};
