export type Conversation = {
  id: string;
  title: string;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { conversations: number };
};
