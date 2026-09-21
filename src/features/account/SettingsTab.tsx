import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "../../components/Button";
import { apiFetch } from "../../lib/api";
import { useSettings } from "../../lib/hooks";
import {
  applyTheme,
  APP_FONT_MIN,
  APP_FONT_MAX,
  APP_FONT_DEFAULT,
  ICON_SCALE_MIN,
  ICON_SCALE_MAX,
  ICON_SCALE_DEFAULT,
  clampAppFontSize,
  clampIconScale,
} from "../../lib/theme";
import { BRANDS, applyBrand, isBrandId, type BrandId } from "../../lib/brandTheme";

const settingsSchema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  fontScale: z.enum(["XSMALL", "SMALL", "DEFAULT", "LARGE", "XLARGE"]),
  brand: z.enum(["default", "chatgpt", "claude", "gemini", "grok", "deepseek"]),
  pinHeader: z.boolean(),
  appFontSize: z.number().int().min(APP_FONT_MIN).max(APP_FONT_MAX),
  iconScale: z.number().min(ICON_SCALE_MIN).max(ICON_SCALE_MAX),
});

const FONT_STEPS = ["XSMALL", "SMALL", "DEFAULT", "LARGE", "XLARGE"] as const;
type FontStep = (typeof FONT_STEPS)[number];
const FONT_STEP_LABELS: Record<FontStep, string> = {
  XSMALL: "Extra small",
  SMALL: "Small",
  DEFAULT: "Default",
  LARGE: "Large",
  XLARGE: "Extra large",
};
const FONT_STEP_SIZES: Record<FontStep, number> = {
  XSMALL: 13,
  SMALL: 14,
  DEFAULT: 16,
  LARGE: 18,
  XLARGE: 20,
};
const DEFAULT_FONT_STEP: FontStep = "DEFAULT";
const toFontStep = (value: unknown): FontStep =>
  FONT_STEPS.includes(value as FontStep) ? (value as FontStep) : DEFAULT_FONT_STEP;

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export const SettingsTab = () => {
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: "SYSTEM",
      fontScale: "DEFAULT",
      brand: "default" as BrandId,
      pinHeader: false,
      appFontSize: APP_FONT_DEFAULT,
      iconScale: ICON_SCALE_DEFAULT,
    },
  });

  useEffect(() => {
    const settings = data?.data?.settings as
      | Partial<SettingsFormValues>
      | undefined;
    if (settings) {
      reset({
        theme: "SYSTEM",
        pinHeader: false,
        ...settings,
        fontScale: toFontStep(settings.fontScale),
        brand: isBrandId(settings.brand) ? settings.brand : "default",
        appFontSize: clampAppFontSize(settings.appFontSize),
        iconScale: clampIconScale(settings.iconScale),
      });
    }
  }, [data, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.theme && values.fontScale) {
        applyTheme(
          values.theme,
          values.fontScale,
          clampAppFontSize(values.appFontSize),
          clampIconScale(values.iconScale)
        );
      }
      if (isBrandId(values.brand)) {
        applyBrand(values.brand);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const watchedTheme = watch("theme");
  const previewMode =
    watchedTheme === "DARK"
      ? "dark"
      : watchedTheme === "LIGHT"
        ? "light"
        : typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

  const onSubmit = async (values: SettingsFormValues) => {
    setStatus(null);
    await apiFetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    setStatus("Saved");
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">Appearance</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="account-stack-lg">
        <div>
          <label className="account-field-label">Theme</label>
          <select
            className="account-select"
            {...register("theme")}
          >
            <option value="SYSTEM">System</option>
            <option value="DARK">Dark</option>
            <option value="LIGHT">Light</option>
          </select>
        </div>
        <div>
          <label className="account-field-label" htmlFor="chat-font-size">
            Chat font size{" "}
            <span className="account-font-size-value">
              {FONT_STEP_SIZES[toFontStep(watch("fontScale"))]}px ·{" "}
              {FONT_STEP_LABELS[toFontStep(watch("fontScale"))]}
            </span>
          </label>
          <input
            id="chat-font-size"
            type="range"
            min={0}
            max={FONT_STEPS.length - 1}
            step={1}
            value={FONT_STEPS.indexOf(toFontStep(watch("fontScale")))}
            onChange={(e) =>
              setValue("fontScale", FONT_STEPS[Number(e.target.value)], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="account-range"
            aria-valuetext={`${FONT_STEP_LABELS[toFontStep(watch("fontScale"))]} ${FONT_STEP_SIZES[toFontStep(watch("fontScale"))]} pixels`}
          />
          <div className="account-range-ends" aria-hidden="true">
            <span className="account-range-end-small">A</span>
            <span className="account-range-end-large">A</span>
          </div>
        </div>
        <div>
          <label className="account-field-label" htmlFor="app-font-size">
            App font size{" "}
            <span className="account-font-size-value">
              {clampAppFontSize(watch("appFontSize"))}px
            </span>
          </label>
          <input
            id="app-font-size"
            type="range"
            min={APP_FONT_MIN}
            max={APP_FONT_MAX}
            step={1}
            value={clampAppFontSize(watch("appFontSize"))}
            onChange={(e) =>
              setValue("appFontSize", Number(e.target.value), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="account-range"
            aria-valuetext={`${clampAppFontSize(watch("appFontSize"))} pixels overall app font`}
          />
          <div className="account-range-ends" aria-hidden="true">
            <span className="account-range-end-small">A</span>
            <span className="account-range-end-large">A</span>
          </div>
        </div>
        <div>
          <label className="account-field-label" htmlFor="icon-size">
            Icon size{" "}
            <span className="account-font-size-value">
              {Math.round(clampIconScale(watch("iconScale")) * 100)}%
            </span>
          </label>
          <input
            id="icon-size"
            type="range"
            min={ICON_SCALE_MIN}
            max={ICON_SCALE_MAX}
            step={0.05}
            value={clampIconScale(watch("iconScale"))}
            onChange={(e) =>
              setValue("iconScale", Math.round(Number(e.target.value) * 100) / 100, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            className="account-range"
            aria-valuetext={`${Math.round(clampIconScale(watch("iconScale")) * 100)} percent icon size`}
          />
          <div className="account-range-ends" aria-hidden="true">
            <span className="account-range-end-small">
              <i className="bi bi-emoji-smile" aria-hidden="true" />
            </span>
            <span className="account-range-end-large">
              <i className="bi bi-emoji-smile" aria-hidden="true" />
            </span>
          </div>
        </div>
        <div>
          <label className="account-check-row">
            <input
              type="checkbox"
              {...register("pinHeader")}
              className="account-check-input"
            />
            <span className="account-check-body">
              <span className="account-field-label account-check-label">
                Fix top action bar / icons
              </span>
              <span className="account-check-hint">
                Keep the top action pill pinned while scrolling. When off,
                it hides on scroll down and reappears on scroll up.
              </span>
            </span>
          </label>
        </div>
        <fieldset>
          <legend className="account-field-label">
            Assistant theme
          </legend>
          <div className="account-brand-list">
            {BRANDS.map((b) => (
              <label
                key={b.id}
                className="account-brand-option"
              >
                <input
                  type="radio"
                  value={b.id}
                  {...register("brand")}
                  className="account-brand-radio"
                />
                <span className="account-brand-body">
                  <span className="account-brand-name">
                    {b.name}
                  </span>
                  <span className="account-brand-tagline">
                    {b.tagline}
                  </span>
                  <span
                    data-brand={b.id}
                    data-theme={previewMode}
                    className="account-brand-preview"
                  >
                    <span className="account-brand-preview-assistant">
                      Aa — assistant reply in {b.name} style
                    </span>
                    <span className="user-message-card account-brand-preview-user">
                      User bubble
                    </span>
                    <span className="account-brand-preview-bar" />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="account-form-actions">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save settings"}
          </Button>
          {status ? <span className="account-status">{status}</span> : null}
        </div>
      </form>
    </div>
  );
};

export default SettingsTab;
