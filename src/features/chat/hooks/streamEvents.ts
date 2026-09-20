import type { MessagesSetter } from "./useChatStreaming";
import type { QuizRound } from "../message/types";

export interface StreamEventCtx {
  setMessages: MessagesSetter;
  tempAssistantId: string;
  isCancelled: () => boolean;
}

/** Applies a `followups` payload. Returns true when the caller should abort. */
export const applyFollowupsEvent = (
  ctx: StreamEventCtx,
  parsed: unknown
): boolean => {
  if (ctx.isCancelled()) return true;
  const items = (parsed as any).followups;
  if (Array.isArray(items)) {
    const cleaned = items
      .filter((v: unknown): v is string => typeof v === "string")
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0 && v.length <= 140)
      .slice(0, 3);
    if (cleaned.length > 0) {
      ctx.setMessages((prev) =>
        prev.map((m) =>
          m.id === ctx.tempAssistantId ? { ...m, followups: cleaned } : m
        )
      );
    }
  }
  return false;
};

/** Applies a `quiz` payload. Returns true when the caller should abort. */
export const applyQuizEvent = (
  ctx: StreamEventCtx,
  parsed: unknown
): boolean => {
  if (ctx.isCancelled()) return true;
  const raw = (parsed as any).quiz ?? parsed;
  if (raw && typeof raw === "object") {
    const questions = (raw as any).questions;
    if (
      Array.isArray(questions) &&
      questions.length > 0 &&
      questions.length <= 50
    ) {
      let valid = true;
      for (const q of questions) {
        if (
          !q ||
          typeof q.question !== "string" ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          !q.options.every((o: unknown) => typeof o === "string") ||
          typeof q.answerIndex !== "number" ||
          !Number.isInteger(q.answerIndex) ||
          q.answerIndex < 0 ||
          q.answerIndex > 3
        ) {
          valid = false;
          break;
        }
      }
      if (valid) {
        const round =
          typeof (raw as any).round === "number" ? (raw as any).round : 1;
        const topic =
          typeof (raw as any).topic === "string" ? (raw as any).topic : "";
        const cleanedQuestions = questions.map((q: any) => ({
          question: q.question as string,
          options: [
            q.options[0] as string,
            q.options[1] as string,
            q.options[2] as string,
            q.options[3] as string,
          ] as [string, string, string, string],
          answerIndex: q.answerIndex as number,
          ...(typeof q.explanation === "string"
            ? { explanation: q.explanation as string }
            : {}),
        }));
        const rawSel = (raw as any).selections;
        const selections: (number | null)[] =
          Array.isArray(rawSel) && rawSel.length === cleanedQuestions.length
            ? rawSel.map((s: unknown) =>
                typeof s === "number" &&
                Number.isInteger(s) &&
                s >= 0 &&
                s <= 3
                  ? s
                  : null
              )
            : Array(cleanedQuestions.length).fill(null);
        const revealed = (raw as any).revealed === true ? true : false;
        const quiz: QuizRound = {
          round,
          topic,
          questions: cleanedQuestions,
          selections,
          revealed,
        };
        ctx.setMessages((prev) =>
          prev.map((m) =>
            m.id === ctx.tempAssistantId ? { ...m, quiz } : m
          )
        );
      }
    }
  }
  return false;
};

/** Applies an `images` payload. Returns true when the caller should abort. */
export const applyImagesEvent = (
  ctx: StreamEventCtx,
  parsed: unknown
): boolean => {
  if (ctx.isCancelled()) return true;
  const urls = (parsed as any).images;
  if (Array.isArray(urls)) {
    const cleaned = urls.filter(
      (v: unknown): v is string =>
        typeof v === "string" && v.startsWith("data:image/")
    );
    if (cleaned.length > 0) {
      ctx.setMessages((prev) =>
        prev.map((m) =>
          m.id === ctx.tempAssistantId
            ? { ...m, images: cleaned, status: "COMPLETE" }
            : m
        )
      );
    }
  }
  return false;
};

/** Applies a `videos` payload. Returns true when the caller should abort. */
export const applyVideosEvent = (
  ctx: StreamEventCtx,
  parsed: unknown
): boolean => {
  if (ctx.isCancelled()) return true;
  const urls = (parsed as any).videos;
  if (Array.isArray(urls)) {
    const cleaned = urls
      .filter(
        (v: unknown): v is string =>
          typeof v === "string" &&
          (v.startsWith("data:video/") || v.startsWith("https:"))
      )
      .slice(0, 3);
    if (cleaned.length > 0) {
      ctx.setMessages((prev) =>
        prev.map((m) =>
          m.id === ctx.tempAssistantId
            ? { ...m, videos: cleaned, status: "COMPLETE" }
            : m
        )
      );
    }
  }
  return false;
};
