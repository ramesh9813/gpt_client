export type TuningPromptItem = {
  id: string;
  text: string;
  enabled: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  customPrompt?: string | null;
  customPromptEnabled?: boolean;
  customPrompts?: TuningPromptItem[];
  mutedFolderPromptIds?: string[];
  _count?: { messages: number };
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  customPrompt?: string | null;
  customPromptEnabled?: boolean;
  customPrompts?: TuningPromptItem[];
  _count?: { conversations: number };
};
