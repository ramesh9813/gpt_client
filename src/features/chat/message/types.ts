export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status?: "COMPLETE" | "STREAMING" | "ERROR";
  model?: string | null;
  images?: string[];
  followups?: string[];
};

export type ModelOption = { label: string; value: string };
