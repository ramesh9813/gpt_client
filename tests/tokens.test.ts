import { describe, expect, it } from "vitest";
import {
  CHARS_PER_TOKEN,
  estimateTokens,
  estimateTurnChars,
  isNearLimit,
  SYSTEM_HEADROOM_CHARS,
} from "../src/lib/tokens";

describe("estimateTurnChars (full history — nothing is trimmed anymore)", () => {
  it("counts the whole history, never clamping to a budget", () => {
    const out = estimateTurnChars({ historyChars: 100_000, inputChars: 500, filesChars: 0, providerId: "openai" });
    expect(out).toBe(100_000 + 500 + SYSTEM_HEADROOM_CHARS);
  });

  it("clamps negatives and includes the system headroom", () => {
    expect(estimateTurnChars({ historyChars: -5, inputChars: 0, filesChars: 0 })).toBe(SYSTEM_HEADROOM_CHARS);
    expect(estimateTurnChars({ historyChars: 10, inputChars: 20, filesChars: 30 })).toBe(60 + SYSTEM_HEADROOM_CHARS);
  });
});

describe("isNearLimit (only providers with a known hard cap warn)", () => {
  it("warns on groq past 70% of its input cap", () => {
    // 7000 * 0.7 = 4900 tokens → ~19600 chars triggers.
    expect(
      isNearLimit({ historyChars: 30_000, inputChars: 0, filesChars: 0, providerId: "groq" })
    ).toBe(true);
  });

  it("stays quiet for unknown-cap providers however long the thread", () => {
    expect(
      isNearLimit({ historyChars: 1_000_000, inputChars: 0, filesChars: 0, providerId: "openai" })
    ).toBe(false);
    expect(isNearLimit({ historyChars: 1_000_000, inputChars: 0, filesChars: 0 })).toBe(false);
  });
});

describe("estimateTokens", () => {
  it("rounds up and never goes negative", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(CHARS_PER_TOKEN)).toBe(1);
    expect(estimateTokens(CHARS_PER_TOKEN + 1)).toBe(2);
    expect(estimateTokens(-100)).toBe(0);
  });
});
