// Token budgeting helpers — client mirror of the server history budgets
// (gpt_server HISTORY). Rough heuristic: ~4 chars per token.

export const CHARS_PER_TOKEN = 4;

// History budgets, mirrored from the server so the live estimate and the
// auto-trim trigger match what /api/chat/stream will actually send.
export const HISTORY_BUDGET_CHARS = 24_000;
export const HISTORY_TIGHT_BUDGET_CHARS = 8_000;
export const HISTORY_COMPACT_BUDGET_CHARS = 4_000;

// Providers with tight per-minute input caps get the tight budget server-side.
export const LOW_BUDGET_PROVIDERS: readonly string[] = ["groq"];

// Known per-minute input-token caps (undefined = unknown/large).
export const PROVIDER_INPUT_LIMITS: Record<string, number> = {
  groq: 7000,
};

export const historyBudgetFor = (providerId?: string | null): number =>
  providerId &&
  LOW_BUDGET_PROVIDERS.includes(providerId.trim().toLowerCase())
    ? HISTORY_TIGHT_BUDGET_CHARS
    : HISTORY_BUDGET_CHARS;

export const providerInputLimit = (
  providerId?: string | null
): number | undefined =>
  providerId
    ? PROVIDER_INPUT_LIMITS[providerId.trim().toLowerCase()]
    : undefined;

export const estimateTokens = (chars: number): number =>
  Math.max(0, Math.ceil(Math.max(0, chars) / CHARS_PER_TOKEN));

export const formatTokenCount = (tokens: number): string => {
  if (!Number.isFinite(tokens)) return "0";
  if (tokens < 1000) return String(Math.round(tokens));
  const k = tokens / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
};

export const threadChars = (
  messages: Array<{ content?: unknown }>
): number =>
  messages.reduce(
    (n, m) => n + (typeof m?.content === "string" ? m.content.length : 0),
    0
  );

// Full-turn size the estimate is based on: capped history + fresh input +
// file payload + system/tuning/search headroom (~1.5k chars).
export const SYSTEM_HEADROOM_CHARS = 1_500;

export const estimateTurnChars = (args: {
  historyChars: number;
  inputChars?: number;
  filesChars?: number;
  providerId?: string | null;
}): number => {
  const history = Math.min(
    Math.max(0, args.historyChars),
    historyBudgetFor(args.providerId)
  );
  return (
    history +
    Math.max(0, args.inputChars ?? 0) +
    Math.max(0, args.filesChars ?? 0) +
    SYSTEM_HEADROOM_CHARS
  );
};

// Near the limit when estimated tokens pass 70% of a known cap, or the raw
// thread passes 90% of the history budget when the cap is unknown.
export const isNearLimit = (args: {
  historyChars: number;
  inputChars?: number;
  filesChars?: number;
  providerId?: string | null;
}): boolean => {
  const limit = providerInputLimit(args.providerId);
  if (limit !== undefined) {
    return (
      estimateTokens(estimateTurnChars(args)) > Math.floor(limit * 0.7)
    );
  }
  return args.historyChars > Math.floor(historyBudgetFor(args.providerId) * 0.9);
};

// Auto-trim engages only when armed AND near the limit — otherwise the full
// budget (and full memory) is kept.
export const shouldCompactHistory = (args: {
  trimArmed: boolean;
  historyChars: number;
  inputChars?: number;
  filesChars?: number;
  providerId?: string | null;
}): boolean => args.trimArmed && isNearLimit(args);
