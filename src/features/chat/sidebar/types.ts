export type Conversation = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  customPrompt?: string | null;
  customPromptEnabled?: boolean;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  customPrompt?: string | null;
  customPromptEnabled?: boolean;
  _count?: { conversations: number };
};
