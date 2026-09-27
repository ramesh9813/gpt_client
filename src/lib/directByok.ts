// Browser-direct provider streaming — fallback for firewalled relays.
//
// When the provider's firewall blocks the SERVER (Cloudflare check on the
// datacenter egress IP), the browser can usually still reach the same API:
// CORS is open on provider /v1/* and the Settings key already lives in this
// browser. So on a challenged relay error the chat replays the exact
// server-prepared turn straight from here with the user's own key, then
// persists it via /api/chat/direct-finish. OpenAI-shaped endpoints only.

export type DirectChatMessage = { role: string; content: unknown };

export type DirectUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type DirectResult = {
  content: string;
  reasoning: string;
  usage: DirectUsage | null;
  cancelled: boolean;
};

// Only the OpenAI wire shape is reproducible here; provider kinds with
// their own shapes (Gemini/Anthropic) stay server-side.
export const isDirectSupported = (providerId: string): boolean =>
  providerId !== "google" && providerId !== "anthropic";

// Provider error text, mirroring the server's byokErrorMessage (kept local
// so this module stays dependency-free): firewall challenge pages name the
// firewall, OpenAI envelopes surface the human message, nothing raw-HTML.
export const directErrorText = (
  providerName: string,
  status: number,
  bodyText: string
): string => {
  if (
    /<\s*!doctype|<\s*html|just a moment|challenges\.cloudflare|cf-challenge|attention required/i.test(
      bodyText
    )
  ) {
    return (
      `${providerName} error (${status}): browser request blocked by the ` +
      `provider's firewall (Cloudflare check) — retry shortly or check the provider status page.`
    );
  }
  const cause =
    status === 401
      ? "Invalid or revoked API key."
      : status === 402
        ? "Out of balance — top up the provider account."
        : status === 403
          ? "Key lacks permission for this call (check the key's scopes in the provider dashboard)."
          : status === 404
            ? "Unknown model or endpoint — refresh the provider's model list and reselect."
            : status === 422
              ? "Invalid request — unknown model or unsupported parameter (refresh the model list and retry)."
              : status === 429
                ? "Rate limited — wait a moment and retry."
                : null;
  let detail = bodyText.slice(0, 500);
  try {
    const parsed = JSON.parse(bodyText);
    const msg = (parsed as any)?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      detail = msg.slice(0, 500);
    }
  } catch {
    // not JSON — keep the raw text
  }
  return `${providerName} error (${status}):${cause ? ` ${cause}` : ""}${detail ? ` ${detail}` : ""}`;
};

export type DirectStreamError = Error & { partialContent?: string };

const asDirectStreamError = (message: string, partialContent: string): DirectStreamError =>
  Object.assign(new Error(message), { partialContent });

export const streamDirectCompletion = async (args: {
  baseUrl: string;
  providerName: string;
  apiKey: string;
  model: string;
  messages: DirectChatMessage[];
  signal: AbortSignal;
  isCancelled: () => boolean;
  onToken: (delta: string) => void;
  onReasoning?: (delta: string) => void;
}): Promise<DirectResult> => {
  let content = "";
  let reasoning = "";
  let usage: DirectUsage | null = null;

  const handleData = (data: string): void => {
    const parsed = JSON.parse(data);
    const errMsg =
      typeof parsed?.error?.message === "string"
        ? parsed.error.message
        : typeof parsed?.error === "string"
          ? parsed.error
          : null;
    if (errMsg !== null) {
      // Mid-stream provider failure frame (e.g. upstream 502).
      const code =
        typeof parsed?.error?.code === "number" ? parsed.error.code : 502;
      throw asDirectStreamError(
        directErrorText(args.providerName, code, JSON.stringify(parsed.error).slice(0, 500)),
        content
      );
    }
    const delta = parsed?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      content += delta;
      args.onToken(delta);
    }
    const r =
      parsed?.choices?.[0]?.delta?.reasoning ??
      parsed?.choices?.[0]?.delta?.reasoning_content;
    if (typeof r === "string" && r.length > 0) {
      reasoning += r;
      args.onReasoning?.(r);
    }
    if (parsed?.usage) usage = parsed.usage;
  };

  const response = await fetch(`${args.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      stream: true,
    }),
    signal: args.signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw asDirectStreamError(
      directErrorText(args.providerName, response.status, text),
      ""
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    let read: ReadableStreamReadResult<Uint8Array>;
    try {
      read = await reader.read();
    } catch (err) {
      if (args.isCancelled()) return { content, reasoning, usage, cancelled: true };
      throw asDirectStreamError(
        (err as Error)?.message || "Direct streaming failed",
        content
      );
    }
    const { value, done } = read;
    if (done) break;
    if (args.isCancelled()) return { content, reasoning, usage, cancelled: true };
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") continue;
      try {
        handleData(data);
      } catch (err) {
        // Error frames carry partial content upward; malformed chunks skip.
        if (err instanceof Error && "partialContent" in err) throw err;
      }
    }
  }
  // Trailing fragment without a closing newline (legal TCP split).
  const tail = `${buffer}${decoder.decode()}`.trim();
  if (tail.startsWith("data:")) {
    const data = tail.replace(/^data:\s*/, "");
    if (data && data !== "[DONE]") {
      try {
        handleData(data);
      } catch (err) {
        if (err instanceof Error && "partialContent" in err) throw err;
      }
    }
  }
  if (args.isCancelled()) return { content, reasoning, usage, cancelled: true };
  return { content, reasoning, usage, cancelled: false };
};
