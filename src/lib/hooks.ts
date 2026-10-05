import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "./api";
import type { BrandId } from "./brandTheme";
import {
  clearCachedMeUser,
  readCachedMeUser,
  writeCachedMeUser,
} from "../features/chat/chatCache";

export type UserRole = "admin" | "owner" | "user";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string | null;
};

export type UserSettings = {
  theme: "SYSTEM" | "DARK" | "LIGHT";
  fontScale: "XSMALL" | "SMALL" | "DEFAULT" | "LARGE" | "XLARGE";
  brand: BrandId;
  pinHeader: boolean;
  showTopCard?: boolean;
  showScrollJump?: boolean;
  showFollowups?: boolean;
  searchProvider?: "auto" | "brave" | "exa" | "youtube" | "duckduckgo";
  model: string;
  imageModel?: string;
  videoModel?: string;
  appFontSize?: number;
  iconScale?: number;
  devicePhotosFolder?: string | null;
  deviceScreenshotsFolder?: string | null;
};

export const useMe = (enabled = true) => {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<ApiResponse<{ user: User }>>("/api/me"),
    retry: false,
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
  });
  // Step 2 persist: next reload paints the shell instantly from cache.
  useEffect(() => {
    const user = query.data?.data?.user;
    if (user) writeCachedMeUser(user);
  }, [query.data]);
  // Stay logged in until explicit logout / real 401: only a confirmed
  // UNAUTHORIZED clears the cached user. Network blips, cold-boot 500s or
  // refresh retries must keep the cache so reloads still paint instantly
  // and don't bounce to /login.
  useEffect(() => {
    const code = (query.error as { error?: { code?: string } } | null | undefined)?.error?.code;
    if (code === "UNAUTHORIZED") clearCachedMeUser();
  }, [query.error]);
  return query;
};

export const getCachedMeForShell = () => readCachedMeUser();

export const useSettings = (enabled = true) =>
  useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      apiFetch<ApiResponse<{ settings: UserSettings }>>("/api/me/settings"),
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
