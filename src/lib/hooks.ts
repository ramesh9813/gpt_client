import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "./api";
import type { BrandId } from "./brandTheme";

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
  fontScale: "SMALL" | "DEFAULT" | "LARGE";
  brand: BrandId;
  pinHeader: boolean;
  model: string;
};

export const useMe = (enabled = true) =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<ApiResponse<{ user: User }>>("/api/me"),
    retry: false,
    enabled
  });

export const useSettings = (enabled = true) =>
  useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      apiFetch<ApiResponse<{ settings: UserSettings }>>("/api/me/settings"),
    enabled
  });
