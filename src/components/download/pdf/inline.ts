import type { Token, Tokens } from "marked";

export type Seg = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
  link?: boolean;
};

export const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

export const flattenInline = (
  tokens: Token[] | undefined,
  style: Omit<Seg, "text"> = {}
): Seg[] => {
  const out: Seg[] = [];
  for (const tok of tokens ?? []) {
    const t = tok as Tokens.Generic;
    switch (t.type) {
      case "text":
      case "escape": {
        const inner = (t as { tokens?: Token[] }).tokens;
        if (inner && inner.length > 0) out.push(...flattenInline(inner, style));
        else if (t.text) out.push({ text: decodeEntities(t.text), ...style });
        break;
      }
      case "strong":
        out.push(
          ...flattenInline((t as Tokens.Strong).tokens, { ...style, bold: true })
        );
        break;
      case "em":
        out.push(
          ...flattenInline((t as Tokens.Em).tokens, { ...style, italic: true })
        );
        break;
      case "del":
        out.push(...flattenInline((t as Tokens.Del).tokens, style));
        break;
      case "codespan":
        out.push({
          text: decodeEntities((t as Tokens.Codespan).text),
          ...style,
          mono: true,
        });
        break;
      case "br":
        out.push({ text: "\n" });
        break;
      case "link": {
        const link = t as Tokens.Link;
        const label =
          flattenInline(link.tokens, style)
            .map((s) => s.text)
            .join("") || link.href;
        out.push({ text: decodeEntities(label), ...style, link: true });
        break;
      }
      case "image": {
        const img = t as Tokens.Image;
        out.push({ text: `[Image: ${img.text || img.href}]`, ...style });
        break;
      }
      case "html":
        break;
      default: {
        const maybe = t as unknown as { text?: string };
        if (maybe.text) out.push({ text: decodeEntities(maybe.text), ...style });
        break;
      }
    }
  }
  return out;
};

export const plainCell = (tokens: Token[] | undefined): string =>
  flattenInline(tokens)
    .map((s) => s.text)
    .join("")
    .replace(/\n+/g, " ");
