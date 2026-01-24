import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch } from "../lib/api";
import { applyTheme } from "../lib/theme";
import { useSettings } from "../lib/hooks";

const schema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontScale: z.enum(["SMALL", "DEFAULT", "LARGE"])
});

type FormValues = z.infer<typeof schema>;

const Settings = () => {
  const { data } = useSettings();
  const [status, setStatus] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      theme: "SYSTEM",
      accentColor: "#74aa9c",
      fontScale: "DEFAULT"
    }
  });

  useEffect(() => {
    const settings = data?.data?.settings;
    if (settings) {
      reset(settings);
    }
  }, [data, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.theme && values.accentColor && values.fontScale) {
        applyTheme(values.theme, values.accentColor, values.fontScale);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const onSubmit = async (values: FormValues) => {
    setStatus(null);
    await apiFetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    setStatus("Saved");
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Settings</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Customize theme and accent color.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="mb-1 block text-sm">Theme</label>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              {...register("theme")}
            >
              <option value="SYSTEM">System</option>
              <option value="DARK">Dark</option>
              <option value="LIGHT">Light</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Accent color</label>
            <div className="flex items-center gap-3">
              <Input type="text" {...register("accentColor")} />
              <input type="color" {...register("accentColor")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">Font size</label>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              {...register("fontScale")}
            >
              <option value="SMALL">Small</option>
              <option value="DEFAULT">Default</option>
              <option value="LARGE">Large</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save settings"}
            </Button>
            {status ? <span className="text-sm text-[var(--muted)]">{status}</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;