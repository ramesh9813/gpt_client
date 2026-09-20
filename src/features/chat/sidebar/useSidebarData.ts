import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../../lib/api";
import type { Conversation, Folder } from "./types";

export function useSidebarData(search: string) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Folder[] }>>("/api/folders")
  });

  const { data } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        `/api/conversations?search=${encodeURIComponent(search)}`
      )
  });

  const { folders, groupedConversations, uncategorized } = useMemo(() => {
    const fs = foldersData?.data?.items || [];
    const cs = data?.data?.items || [];
    const groups: Record<string, Conversation[]> = {};
    const uncat: Conversation[] = [];
    cs.forEach(c => {
      if (c.folderId) {
        if (!groups[c.folderId]) groups[c.folderId] = [];
        groups[c.folderId].push(c);
      } else {
        uncat.push(c);
      }
    });
    return {
      folders: fs,
      groupedConversations: groups,
      uncategorized: uncat.sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    };
  }, [foldersData, data]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return {
    folders,
    groupedConversations,
    uncategorized,
    expandedFolders,
    toggleFolder,
  };
}
