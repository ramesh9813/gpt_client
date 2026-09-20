import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsDark } from "../../../lib/useIsDark";
import { apiFetch, ApiResponse } from "../../../lib/api";
import { CopyButton } from "./MessageButtons";

const RUN_LANGS = new Set(["python", "py", "c", "cpp", "c++", "rust", "rs", "java"]);

const normalizeRunLanguage = (language: string) => {
  const lang = language.toLowerCase();
  if (lang === "py") return "python";
  if (lang === "c++") return "cpp";
  if (lang === "rs") return "rust";
  return lang;
};

export const CodeBlockWithRun = ({
  language,
  code
}: {
  language: string;
  code: string;
}) => {
  const normalized = normalizeRunLanguage(language);
  const runnable = RUN_LANGS.has(language.toLowerCase());
  const isDark = useIsDark();
  const [runState, setRunState] = useState<{
    status: "idle" | "running" | "done" | "error";
    output?: string;
    stderr?: string;
    code?: number | null;
  }>({ status: "idle" });

  const handleRun = async () => {
    setRunState({ status: "running" });
    try {
      const response = await apiFetch<
        ApiResponse<{ stdout?: string; stderr?: string; output?: string; code?: number }>
      >("/api/runner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: normalized,
          code
        })
      });
      const output = response.data.output || response.data.stdout || "";
      const stderr = response.data.stderr || "";
      setRunState({
        status: "done",
        output: output || stderr || "No output.",
        stderr,
        code: response.data.code ?? null
      });
    } catch (err: any) {
      setRunState({
        status: "error",
        output: err?.error?.message || "Run failed.",
        stderr: err?.error?.message
      });
    }
  };

  return (
    <div className="msg-codeblock">
      <div className="msg-codeblock-head">
        <span className="msg-codeblock-lang">{language}</span>
        <div className="msg-codeblock-actions">
          {runnable && (
            <button
              onClick={handleRun}
              className="msg-codeblock-text-btn"
              disabled={runState.status === "running"}
              type="button"
              title="Run code"
            >
              <i
                className={`bi ${
                  runState.status === "running"
                    ? "bi-hourglass-split"
                    : "bi-play-fill"
                }`}
              ></i>
              {runState.status === "running" ? "Running..." : "Run"}
            </button>
          )}
          {runState.status !== "idle" && (
            <button
              onClick={() => setRunState({ status: "idle" })}
              className="msg-codeblock-text-btn"
              type="button"
              title="Clear output"
            >
              <i className="bi bi-trash"></i>
              Clear
            </button>
          )}
          <CopyButton text={code} showText={false} />
        </div>
      </div>
      <SyntaxHighlighter
        PreTag="div"
        language={language}
        style={isDark ? vscDarkPlus : oneLight}
        codeTagProps={{
          style: {
            backgroundColor: "transparent",
            padding: 0
          }
        }}
        customStyle={{
          margin: 0,
          background: "transparent",
          backgroundColor: "transparent",
          padding: "0.25rem 1rem 1rem",
          fontSize: "14px",
          lineHeight: 1.6,
          borderRadius: 0,
          border: "none",
          boxShadow: "none",
          overflowX: "auto"
        }}
      >
        {code.replace(/\n$/, "")}
      </SyntaxHighlighter>
      {runnable && runState.status !== "idle" ? (
        <div className="msg-codeblock-output">
          <div className="msg-codeblock-output-head">
            <span>Output</span>
            {typeof runState.code === "number" ? (
              <span>Exit {runState.code}</span>
            ) : null}
          </div>
          <pre className="msg-codeblock-output-pre">
            {runState.output || runState.stderr || "No output."}
          </pre>
        </div>
      ) : null}
    </div>
  );
};
