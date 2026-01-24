import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "./api";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  lastLoginAt?: string | null;
};

export type UserSettings = {
  theme: "SYSTEM" | "DARK" | "LIGHT";
  accentColor: string;
  fontScale: "SMALL" | "DEFAULT" | "LARGE";
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
