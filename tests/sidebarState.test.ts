import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mod from "../src/features/chat/sidebarState";
import { ARMED_FLAGS_EVENT, readShowSources, SHOW_SOURCES_KEY, writeArmedFlag } from "../src/features/chat/sidebarState";

describe("readShowSources", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults ON for a fresh browser", () => {
    expect(readShowSources()).toBe(true);
  });

  it("honors an explicit off", () => {
    window.localStorage.setItem(SHOW_SOURCES_KEY, "false");
    expect(readShowSources()).toBe(false);
    window.localStorage.setItem(SHOW_SOURCES_KEY, "true");
    expect(readShowSources()).toBe(true);
  });
});

describe("writeArmedFlag", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists the value and broadcasts the event on the same window", () => {
    const seen: Array<{ key?: unknown; value?: unknown }> = [];
    const listener = (e: Event) => {
      seen.push((e as CustomEvent).detail);
    };
    window.addEventListener(ARMED_FLAGS_EVENT, listener);
    try {
      writeArmedFlag(SHOW_SOURCES_KEY, false);
    } finally {
      window.removeEventListener(ARMED_FLAGS_EVENT, listener);
    }
    expect(window.localStorage.getItem(SHOW_SOURCES_KEY)).toBe("false");
    expect(seen).toEqual([{ key: SHOW_SOURCES_KEY, value: false }]);
    expect(readShowSources()).toBe(false);
  });
});

describe("removed features stay removed", () => {
  it("no longer exports the prompt-only armed flag or its reader", () => {
    expect((mod as Record<string, unknown>).PROMPTONLY_ARMED_KEY).toBeUndefined();
    expect((mod as Record<string, unknown>).readPromptOnlyArmed).toBeUndefined();
    expect(window.localStorage.getItem("chatapp.promptonly.armed")).toBeNull();
  });
});
