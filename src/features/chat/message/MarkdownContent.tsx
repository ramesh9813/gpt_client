import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlockWithRun } from "./CodeBlockWithRun";

export const MarkdownContent = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Citations (incl. web-search sources) open in a new tab.
        a(props) {
          const { children, node, ...rest } = props;
          return (
            <a {...rest} target="_blank" rel="noreferrer">
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
