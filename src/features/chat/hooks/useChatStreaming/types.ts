import type { Dispatch, SetStateAction } from "react";
import type { ChatMessage } from "../../MessageList";

export type MessagesSetter = Dispatch<SetStateAction<ChatMessage[]>>;
export type StreamAssistantArgs = {
  tempAssistantId: string;
  conversationId: string;
  userMessage?: string;
  images?: string[];
  files?: Array<{ name: string; mime: string; size: number; content: string }>;
  existingUserMessageId?: string;
  selectedModel?: string;
  research?: boolean;
  artifact?: boolean;
  webSearch?: boolean;
  think?: boolean;
};
