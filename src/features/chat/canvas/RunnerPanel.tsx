import { useState } from "react";
import type { CanvasBlock } from "../canvas";
import { apiFetch, ApiResponse } from "../../../lib/api";
import { normalizeRunLanguage } from "./canvasUtils";

export type RunRecord = {
  status: "idle" | "running" | "done" | "error";
  stdout?: string;
  stderr?: string;
  code?: number;
};

export const useCodeRunner = () => {
  const [runState, setRunState] = useState<Record<string, RunRecord>>({});

  const runBlock = async (block: CanvasBlock) => {
    const language = normalizeRunLanguage(block.language);
    setRunState((prev) => ({
      ...prev,
      [block.id]: { status: "running" }
    }));
    try {
      const response = await apiFetch<
        ApiResponse<{ stdout?: string; stderr?: string; output?: string; code?: number }>
      >("/api/runner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: block.code
        })
      });
      const output = response.data.output || "";
      const stdout = response.data.stdout || "";
      const stderr = response.data.stderr || "";
      setRunState((prev) => ({
        ...prev,
        [block.id]: {
          status: "done",
          stdout: output || stdout,
          stderr,
          code: response.data.code
        }
      }));
    } catch (err: any) {
      const message =
        err?.error?.message || "Run failed. Please try again.";
      setRunState((prev) => ({
        ...prev,
        [block.id]: {
          status: "error",
          stderr: message
        }
      }));
    }
  };

  return { runState, runBlock };
};

type RunnerPanelProps = {
  activeBlock?: CanvasBlock;
  currentRun?: RunRecord;
  isRunning: boolean;
  showRunButton: boolean;
  onRun: () => void;
};

export const RunnerPanel = ({
  activeBlock,
  currentRun,
  isRunning,
  showRunButton,
  onRun,
}: RunnerPanelProps) => {
  if (!activeBlock) return null;
  return (
    <>
      {showRunButton ? (
        <div className="canvas-run-row">
          <button
            onClick={onRun}
            className="canvas-run-btn"
            title="Run code"
            type="button"
            disabled={isRunning}
          >
            <i className={`bi ${isRunning ? "bi-hourglass-split" : "bi-play-fill"}`}></i>
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      ) : null}
      {currentRun ? (
        <div className="canvas-output">
          <div className="canvas-output-head">
            <span>Run output</span>
            {typeof currentRun.code === "number" ? (
              <span>Exit {currentRun.code}</span>
            ) : null}
          </div>
          <pre className="canvas-output-pre">
            {currentRun.stdout || currentRun.stderr || "No output."}
          </pre>
        </div>
      ) : null}
    </>
  );
};

export default RunnerPanel;
