import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatCanvas } from "../src/features/chat/hooks/useChatCanvas";

describe("useChatCanvas (file viewer state)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const mount = () => renderHook(() => useChatCanvas([])).result;

  it("stays closed with no code blocks and no file open", () => {
    const res = mount();
    expect(res.current.showCanvas).toBe(false);
    expect(res.current.fileView).toBeNull();
  });

  it("openFile opens the panel with the file, closeCanvas clears it after the animation", () => {
    const res = mount();
    act(() => {
      res.current.openFile({ name: "report.pdf", mime: "application/pdf", size: 1024, attachmentId: "a1" });
    });
    expect(res.current.showCanvas).toBe(true);
    expect(res.current.fileView).toMatchObject({ name: "report.pdf", attachmentId: "a1" });

    act(() => {
      res.current.closeCanvas();
    });
    // With no code blocks left to show, the close is immediate: the file
    // view clears and the effect force-closes the panel (no animation wait).
    expect(res.current.fileView).toBeNull();
    expect(res.current.showCanvas).toBe(false);
    expect(res.current.canvasClosing).toBe(false);
  });

  it("openFile cancels an in-flight close animation", () => {
    const res = mount();
    act(() => {
      res.current.openCanvas();
    });
    act(() => {
      res.current.closeCanvas();
    });
    act(() => {
      res.current.openFile({ name: "main.py", mime: "text/x-python", size: 10, attachmentId: "a2" });
    });
    expect(res.current.showCanvas).toBe(true);
    expect(res.current.canvasClosing).toBe(false);
    expect(res.current.fileView?.name).toBe("main.py");
  });

  it("openCanvas shows the panel without a file view", () => {
    const res = mount();
    act(() => {
      res.current.openCanvas();
    });
    expect(res.current.showCanvas).toBe(true);
    expect(res.current.fileView).toBeNull();
  });
});
