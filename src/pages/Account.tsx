import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch, ApiResponse } from "../lib/api";
import { useMe, useSettings } from "../lib/hooks";
import { applyTheme } from "../lib/theme";
import { UsageChart, UsageLog } from "../features/settings/UsageChart";

// --- Types ---
// UsageLog imported from features/settings/UsageChart

// --- Settings Logic ---
const settingsSchema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontScale: z.enum(["SMALL", "DEFAULT", "LARGE"]),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const SettingsTab = () => {
  const { data } = useSettings();
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
      accentColor: "#74aa9c",
      fontScale: "DEFAULT",
    },
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

  const onSubmit = async (values: SettingsFormValues) => {
    setStatus(null);
    await apiFetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setStatus("Saved");
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">Appearance</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Theme</label>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            {...register("theme")}
          >
            <option value="SYSTEM">System</option>
            <option value="DARK">Dark</option>
            <option value="LIGHT">Light</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Accent color</label>
          <div className="flex items-center gap-3">
            <Input type="text" {...register("accentColor")} />
            <div className="h-9 w-9 overflow-hidden rounded-full border border-[var(--border)] shadow-sm">
              <input 
                type="color" 
                className="h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0" 
                {...register("accentColor")} 
              />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Font size</label>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            {...register("fontScale")}
          >
            <option value="SMALL">Small</option>
            <option value="DEFAULT">Default</option>
            <option value="LARGE">Large</option>
          </select>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save settings"}
          </Button>
          {status ? <span className="text-sm text-[var(--muted)]">{status}</span> : null}
        </div>
      </form>
    </div>
  );
};

// --- Usage Tab ---
const UsageTab = () => {
  const { data: usageData } = useQuery({
    queryKey: ["usage", "year"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: UsageLog[] }>>("/api/me/usage?range=year"),
  });

  const logs = usageData?.data?.items || [];
  const totalTokensToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return logs.reduce((acc, log) => {
      const createdAt = new Date(log.createdAt);
      return createdAt >= start ? acc + (log.tokenCount || 0) : acc;
    }, 0);
  }, [logs]);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const sortedLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [logs]
  );
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedLogs = sortedLogs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const startIndex = sortedLogs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, sortedLogs.length);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="mb-2 text-xl font-semibold">Usage Statistics (Today)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="text-sm text-[var(--muted)]">Tokens Used (Today)</div>
            <div className="mt-2 text-2xl font-semibold">{totalTokensToday}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
             <div className="text-sm text-[var(--muted)]">Current Plan</div>
             <div className="mt-2 text-2xl font-semibold">Free</div>
          </div>
        </div>
      </div>

      <div className="h-96 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <UsageChart logs={logs} />
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Detailed Logs</h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date & Time</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-right">Input</th>
                <th className="px-4 py-3 font-medium text-right">Output</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--bg)]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    No usage recorded yet.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--panel)]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">{log.model || "-"}</td>
                    <td className="px-4 py-3 text-right">{log.promptTokens ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{log.completionTokens ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{log.tokenCount ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedLogs.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <span>
              Showing {startIndex}-{endIndex} of {sortedLogs.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 px-3"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                className="h-9 px-3"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// --- Main Account Component ---

type Tab = "profile" | "settings" | "security" | "data_controls" | "payment" | "usage" | "connectapp";

const Account = () => {
  const { data: meData } = useMe();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "profile", label: "Profile", icon: "bi-person" },
    { id: "settings", label: "Settings", icon: "bi-gear" },
    { id: "security", label: "Security", icon: "bi-shield-lock" },
    { id: "data_controls", label: "Data Controls", icon: "bi-database-lock" },
    { id: "payment", label: "Payment", icon: "bi-credit-card" },
    { id: "usage", label: "Usage", icon: "bi-graph-up" },
    { id: "connectapp", label: "Connected Apps", icon: "bi-grid" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="max-w-xl">
            <h2 className="mb-6 text-xl font-semibold">Profile Information</h2>
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
                <div className="flex items-center gap-4 mb-6">
                   <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-2xl font-semibold text-white">
                    {(meData?.data?.user?.name?.[0] || meData?.data?.user?.email?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{meData?.data?.user?.name || "User"}</h3>
                    <p className="text-[var(--muted)]">{meData?.data?.user?.email}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase font-semibold text-[var(--muted)]">Email</label>
                    <div className="mt-1 text-sm">{meData?.data?.user?.email}</div>
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-[var(--muted)]">Role</label>
                    <div className="mt-1 text-sm">{meData?.data?.user?.role}</div>
                  </div>
                </div>
              </div>

              <div>
                <Button onClick={logout} disabled={loading} variant="destructive">
                  {loading ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </div>
          </div>
        );
      case "settings":
        return <SettingsTab />;
      case "security":
        return (
          <div className="max-w-xl">
            <h2 className="mb-4 text-xl font-semibold">Security</h2>
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
                <h3 className="mb-4 text-base font-medium">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm">Current Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">New Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Confirm New Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div className="pt-2">
                    <Button disabled variant="outline">Update Password (Coming Soon)</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "data_controls":
         return (
          <div className="max-w-xl">
            <h2 className="mb-4 text-xl font-semibold">Data Controls</h2>
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6">
                <h3 className="mb-2 text-base font-medium">Export Data</h3>
                <p className="mb-4 text-sm text-[var(--muted)]">
                  Download all your conversations and account data in JSON format.
                </p>
                <Button variant="outline" disabled>Export All Data</Button>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
                <h3 className="mb-2 text-base font-medium text-red-500">Delete Account</h3>
                <p className="mb-4 text-sm text-[var(--muted)]">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" disabled>Delete Account</Button>
              </div>
            </div>
          </div>
        );
      case "payment":
        return (
          <div className="max-w-xl">
            <h2 className="mb-4 text-xl font-semibold">Payment Methods</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center text-[var(--muted)]">
              <i className="bi bi-credit-card mb-3 block text-3xl opacity-50"></i>
              <p>No payment methods added yet.</p>
              <Button className="mt-4" variant="outline">Add Payment Method</Button>
            </div>
          </div>
        );
      case "usage":
        return <UsageTab />;
      case "connectapp":
        return (
          <div className="max-w-xl">
            <h2 className="mb-4 text-xl font-semibold">Connected Apps</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center text-[var(--muted)]">
               <i className="bi bi-grid mb-3 block text-3xl opacity-50"></i>
              <p>You haven't connected any external applications.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:flex-row">
        {/* Left Sidebar */}
        <nav className="w-full flex-shrink-0 md:w-64">
           <div className="mb-8">
            <h1 className="text-2xl font-bold">Account</h1>
          </div>
          <ul className="flex flex-row space-x-2 overflow-x-auto md:flex-col md:space-x-0 md:space-y-1 pb-2 md:pb-0">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-[var(--panel)] text-[var(--text)]"
                      : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
                  }`}
                >
                  <i className={`bi ${tab.icon}`}></i>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right Content */}
        <main className="flex-1 min-w-0">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Account;
