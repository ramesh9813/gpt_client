// Token estimate helpers. The server sends the FULL conversation history
// every turn (nothing is trimmed), so the estimate counts all of it.
// Rough heuristic: ~4 chars per token.

export const CHARS_PER_TOKEN = 4;

// Known per-minute input-token caps (undefined = unknown/large).
export const PROVIDER_INPUT_LIMITS: Record<string, number> = {
  groq: 7000,
};

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

// Full-turn size the estimate is based on: full history + fresh input +
// file payload + system/tuning/search headroom (~1.5k chars).
export const SYSTEM_HEADROOM_CHARS = 1_500;

export const estimateTurnChars = (args: {
  historyChars: number;
  inputChars?: number;
  filesChars?: number;
  providerId?: string | null;
}): number => {
  return (
    Math.max(0, args.historyChars) +
    Math.max(0, args.inputChars ?? 0) +
    Math.max(0, args.filesChars ?? 0) +
    SYSTEM_HEADROOM_CHARS
  );
};

// Near the limit when estimated tokens pass 70% of a known provider input
// cap — over that the request itself will be rejected. Providers without a
// known cap never trip the warning.
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
  return false;
};
