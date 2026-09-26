export type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation?: string;
};

export type QuizRound = {
  round: number;
  topic: string;
  questions: QuizQuestion[];
  selections?: (number | null)[];
  revealed?: boolean;
};

// Live generation phase of the currently streaming turn. Drives the
// "what is happening" status (searching / planning artifact / generating
// image / generating quiz) shown while tokens arrive.
export type TurnKind =
  | "text"
  | "research"
  | "artifact"
  | "websearch"
  | "mcq"
  | "image"
  | "video";

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  reasoning?: string;
  status?: "COMPLETE" | "STREAMING" | "ERROR";
  model?: string | null;
  images?: string[];
  videos?: string[];
  followups?: string[];
  quiz?: QuizRound;
  // Wall-clock time the assistant turn took (ms), set when the turn settles.
  durationMs?: number | null;
  // Web-search turns: cited sources + flag (persisted on the server message).
  usedSearch?: boolean;
  sources?: { title: string; url: string }[];
  // Transient system notice for the in-flight turn (e.g. "Search unavailable,
  // answering from general knowledge."). Not persisted — shown as a banner.
  notice?: string;
};

export type ModelOption = { label: string; value: string };
