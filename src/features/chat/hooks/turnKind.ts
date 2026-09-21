import type { MutableRefObject } from "react";
import type { TurnKind } from "../message/types";
import { wantsImagePrompt, wantsVideoPrompt } from "./modelCatalog";
import type { MessagesSetter, StreamAssistantArgs } from "./useChatStreaming";

// Mirrors gpt_server artifact intent so edited simulation prompts keep
// their turn kind for the status indicator.
export const ARTIFACT_KEYWORDS = /\b(simulation|simulator|interactive visualization|artifact)\b/i;
export const MCQ_PREFIX = /^\s*mcq\b/i;

export const detectTurnKind = (
  text: string,
  opts?: { research?: boolean; artifact?: boolean; webSearch?: boolean }
): TurnKind => {
  if (opts?.webSearch) return "websearch";
  if (opts?.research) return "research";
  if (opts?.artifact) return "artifact";
  if (MCQ_PREFIX.test(text)) return "mcq";
  if (wantsVideoPrompt(text)) return "video";
  if (wantsImagePrompt(text)) return "image";
  if (ARTIFACT_KEYWORDS.test(text)) return "artifact";
  return "text";
};

export const detectRegenKind = (
  regenTarget: { quiz?: unknown; images?: string[]; videos?: string[] } | undefined,
  userContent: string
): TurnKind => {
  if (regenTarget?.quiz) return "mcq";
  if ((regenTarget?.images?.length ?? 0) > 0) return "image";
  if ((regenTarget?.videos?.length ?? 0) > 0) return "video";
  return detectTurnKind(userContent);
};

export type StreamAssistantFn = (
  setMessages: MessagesSetter,
  args: StreamAssistantArgs
) => Promise<void>;

export type UseChatMessagesOptions = {
  conversationId: string | undefined;
  model: string;
  setModel: (value: string) => void;
  streaming: boolean;
  setStreaming: (value: boolean) => void;
  activeStreamId: string | null;
  setActiveStreamId: (value: string | null) => void;
  cancelRef: MutableRefObject<boolean>;
  streamAssistant: StreamAssistantFn;
  resolveModelForPrompt?: (text: string) => string;
};
