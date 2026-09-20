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

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status?: "COMPLETE" | "STREAMING" | "ERROR";
  model?: string | null;
  images?: string[];
  videos?: string[];
  followups?: string[];
  quiz?: QuizRound;
};

export type ModelOption = { label: string; value: string };
