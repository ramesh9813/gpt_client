import { z } from "zod";
import {
  APP_FONT_MIN,
  APP_FONT_MAX,
  ICON_SCALE_MIN,
  ICON_SCALE_MAX,
} from "../../lib/theme";
import type { OpenRouterModel } from "../chat/hooks/modelCache";

export const settingsSchema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  fontScale: z.enum(["XSMALL", "SMALL", "DEFAULT", "LARGE", "XLARGE"]),
  brand: z.enum(["default", "chatgpt", "claude", "gemini", "grok", "deepseek"]),
  pinHeader: z.boolean(),
  appFontSize: z.number().int().min(APP_FONT_MIN).max(APP_FONT_MAX),
  iconScale: z.number().min(ICON_SCALE_MIN).max(ICON_SCALE_MAX),
  model: z.string().min(1).max(200),
  imageModel: z.string().min(1).max(200),
  videoModel: z.string().min(1).max(200),
});

export const toModelId = (value: unknown): string =>
  typeof value === "string" && value.length > 0 ? value : "default";

export const shortModelName = (m: OpenRouterModel): string => {
  const name = m.name || m.id;
  if (name.includes(": ")) return name.split(": ").slice(1).join(": ").trim();
  if (name.includes(":")) return name.split(":").slice(1).join(":").trim();
  return name.trim();
};

export const FONT_STEPS = ["XSMALL", "SMALL", "DEFAULT", "LARGE", "XLARGE"] as const;
export type FontStep = (typeof FONT_STEPS)[number];
export const FONT_STEP_LABELS: Record<FontStep, string> = {
  XSMALL: "Extra small",
  SMALL: "Small",
  DEFAULT: "Default",
  LARGE: "Large",
  XLARGE: "Extra large",
};
export const FONT_STEP_SIZES: Record<FontStep, number> = {
  XSMALL: 13,
  SMALL: 14,
  DEFAULT: 18,
  LARGE: 18,
  XLARGE: 20,
};
export const DEFAULT_FONT_STEP: FontStep = "DEFAULT";
export const toFontStep = (value: unknown): FontStep =>
  FONT_STEPS.includes(value as FontStep) ? (value as FontStep) : DEFAULT_FONT_STEP;

export const resolvePreviewMode = (theme: unknown): "dark" | "light" =>
  theme === "DARK"
    ? "dark"
    : theme === "LIGHT"
      ? "light"
      : typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

export type SettingsFormValues = z.infer<typeof settingsSchema>;
