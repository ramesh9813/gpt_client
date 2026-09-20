import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "../../components/Button";
import { apiFetch } from "../../lib/api";
import { useSettings } from "../../lib/hooks";
import { applyTheme } from "../../lib/theme";
import { BRANDS, applyBrand, isBrandId, type BrandId } from "../../lib/brandTheme";

const settingsSchema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  fontScale: z.enum(["SMALL", "DEFAULT", "LARGE"]),
  brand: z.enum(["default", "chatgpt", "claude", "gemini", "grok", "deepseek"]),
  pinHeader: z.boolean(),
});

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
    formState: { isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: "SYSTEM",
      fontScale: "DEFAULT",
      brand: "default" as BrandId,
      pinHeader: false,
    },
  });

  useEffect(() => {
    const settings = data?.data?.settings as
      | Partial<SettingsFormValues>
      | undefined;
    if (settings) {
      reset({
        theme: "SYSTEM",
        fontScale: "DEFAULT",
        pinHeader: false,
        ...settings,
        brand: isBrandId(settings.brand) ? settings.brand : "default",
      });
    }
  }, [data, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.theme && values.fontScale) {
        applyTheme(values.theme, values.fontScale);
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
          <label className="account-field-label">Font size</label>
          <select
            className="account-select"
            {...register("fontScale")}
          >
            <option value="SMALL">Small</option>
            <option value="DEFAULT">Default</option>
            <option value="LARGE">Large</option>
          </select>
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
