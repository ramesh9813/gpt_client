import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "../../../lib/api";
import type { Conversation, Folder } from "./types";
import {
  readCachedConversations,
  readCachedFolders,
  writeCachedConversations,
  writeCachedFolders,
} from "../chatCache";

export function useSidebarData(search: string) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  // Step 1: instant paint from localStorage so the sidebar shell never waits.
  const [cachedConversations] = useState<Conversation[] | null>(() => readCachedConversations());
  const [cachedFolders] = useState<Folder[] | null>(() => readCachedFolders());
  const isSearching = search.trim().length > 0;

  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Folder[] }>>("/api/folders"),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
  });

  const { data } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        `/api/conversations?search=${encodeURIComponent(search)}`
      ),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
  });

  // Step 2: persist DB truth for the next instant paint (unfiltered list only;
  // search results must never overwrite the full cache).
  useEffect(() => {
    const items = data?.data?.items;
    if (!isSearching && items) writeCachedConversations(items);
  }, [data, isSearching]);
  useEffect(() => {
    const items = foldersData?.data?.items;
    if (items) writeCachedFolders(items);
  }, [foldersData]);

  const { folders, groupedConversations, uncategorized } = useMemo(() => {
    // Live DB data wins; cached list paints instantly while it loads.
    // While searching, only live results count (no cache mixing).
    const fs = foldersData?.data?.items ?? cachedFolders ?? [];
    const cs = data?.data?.items ?? (isSearching ? [] : (cachedConversations ?? []));
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
  }, [foldersData, data, cachedConversations, cachedFolders, isSearching]);

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
