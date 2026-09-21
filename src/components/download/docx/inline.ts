import type { Token, Tokens } from "marked";
import { ExternalHyperlink, ShadingType, TextRun } from "docx";
import type { InlineStyle } from "./styles";
import { CODE_BG, INK, LINK_BLUE, MONO, MUTED } from "./styles";

export const styleRun = (
  text: string,
  style: InlineStyle,
  extra?: { color?: string; size?: number }
): TextRun => {
  if (style.code) {
    return new TextRun({
      text,
      font: MONO,
      size: 19,
      color: extra?.color ?? INK,
      shading: { type: ShadingType.CLEAR, fill: CODE_BG },
    });
  }
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    color: extra?.color,
    size: extra?.size,
  });
};

// Recursive inline renderer: bold / italic / strike / code / links / images.
export const renderInline = (
  tokens: Token[] | undefined,
  style: InlineStyle = {}
): (TextRun | ExternalHyperlink)[] => {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const tok of tokens ?? []) {
    const t = tok as Tokens.Generic;
    switch (t.type) {
      case "text":
      case "escape": {
        const inner = (t as { tokens?: Token[] }).tokens;
        if (inner && inner.length > 0) out.push(...renderInline(inner, style));
        else if (t.text) out.push(styleRun(t.text, style));
        break;
      }
      case "strong":
        out.push(
          ...renderInline((t as Tokens.Strong).tokens, { ...style, bold: true })
        );
        break;
      case "em":
        out.push(
          ...renderInline((t as Tokens.Em).tokens, { ...style, italics: true })
        );
        break;
      case "del":
        out.push(
          ...renderInline((t as Tokens.Del).tokens, { ...style, strike: true })
        );
        break;
      case "codespan":
        out.push(
          styleRun((t as Tokens.Codespan).text, { ...style, code: true })
        );
        break;
      case "br":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link": {
        const link = t as Tokens.Link;
        const labelRuns = renderInline(link.tokens, style).filter(
          (n): n is TextRun => n instanceof TextRun
        );
        const label =
          labelRuns
            .map((r) => (r as unknown as { text?: string }).text ?? "")
            .join("") || link.href;
        out.push(
          new ExternalHyperlink({
            link: link.href,
            children: [
              new TextRun({ text: label, color: LINK_BLUE, underline: {} }),
            ],
          })
        );
        break;
      }
      case "image": {
        const img = t as Tokens.Image;
        out.push(
          styleRun(`[Image: ${img.text || img.href}]`, style, {
            color: MUTED,
            size: 20,
          })
        );
        break;
      }
      case "html":
        break;
      default:
        if ((t as unknown as { text?: string }).text)
          out.push(styleRun((t as unknown as { text: string }).text, style));
        break;
    }
  }
  return out;
};
