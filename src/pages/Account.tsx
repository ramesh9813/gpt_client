import "./Account.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch, ApiResponse, clearAuthStorage } from "../lib/api";
import { useMe, useSettings } from "../lib/hooks";
import { applyTheme } from "../lib/theme";
import { BRANDS, applyBrand, isBrandId, type BrandId } from "../lib/brandTheme";
import { UsageChart, UsageLog } from "../features/settings/UsageChart";

// --- Types ---
// UsageLog imported from features/settings/UsageChart

// --- Settings Logic ---
const settingsSchema = z.object({
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontScale: z.enum(["SMALL", "DEFAULT", "LARGE"]),
  brand: z.enum(["default", "chatgpt", "claude", "gemini", "grok", "deepseek"]),
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
      brand: "default" as BrandId,
    },
  });

  useEffect(() => {
    const settings = data?.data?.settings as
      | Partial<SettingsFormValues>
      | undefined;
    if (settings) {
      reset({
        theme: "SYSTEM",
        accentColor: "#74aa9c",
        fontScale: "DEFAULT",
        ...settings,
        brand: isBrandId(settings.brand) ? settings.brand : "default",
      });
    }
  }, [data, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.theme && values.accentColor && values.fontScale) {
        applyTheme(values.theme, values.accentColor, values.fontScale);
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
          <label className="account-field-label">Accent color</label>
          <div className="account-accent-row">
            <Input type="text" {...register("accentColor")} />
            <div className="account-color-swatch">
              <input 
                type="color" 
                className="account-color-input" 
                {...register("accentColor")} 
              />
            </div>
          </div>
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
    <div className="account-wide">
      <div>
        <h2 className="account-usage-title">Usage Statistics (Today)</h2>
        <div className="account-stat-grid">
          <div className="account-stat-card">
            <div className="account-stat-label">Tokens Used (Today)</div>
            <div className="account-stat-value">{totalTokensToday}</div>
          </div>
          <div className="account-stat-card">
             <div className="account-stat-label">Current Plan</div>
             <div className="account-stat-value">Free</div>
          </div>
        </div>
      </div>

      <div className="account-chart-card">
        <UsageChart logs={logs} />
      </div>

      <div>
        <h3 className="account-log-title">Detailed Logs</h3>
        <div className="account-table-wrap">
          <table className="account-table">
            <thead className="account-table-head">
              <tr>
                <th className="account-table-th">Date & Time</th>
                <th className="account-table-th">Model</th>
                <th className="account-table-th-right">Input</th>
                <th className="account-table-th-right">Output</th>
                <th className="account-table-th-right">Total</th>
              </tr>
            </thead>
            <tbody className="account-table-body">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="account-table-empty">
                    No usage recorded yet.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => (
                  <tr key={log.id} className="account-table-row">
                    <td className="account-table-td-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                      <span className="account-table-date-sub">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="account-table-td">{log.model || "-"}</td>
                    <td className="account-table-td-right">{log.promptTokens ?? "-"}</td>
                    <td className="account-table-td-right">{log.completionTokens ?? "-"}</td>
                    <td className="account-table-td-right-bold">{log.tokenCount ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedLogs.length > 0 ? (
          <div className="account-pagination">
            <span>
              Showing {startIndex}-{endIndex} of {sortedLogs.length}
            </span>
            <div className="account-pagination-controls">
              <Button
                variant="outline"
                className="account-pagination-btn"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="account-pagination-label">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                className="account-pagination-btn"
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    } finally {
      clearAuthStorage();
      queryClient.clear();
      setLoading(false);
      navigate("/login", { replace: true });
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
          <div className="account-narrow">
            <h2 className="account-section-title-spaced">Profile Information</h2>
            <div className="account-stack-lg">
              <div className="account-card">
                <div className="account-profile-header">
                   <div className="account-avatar">
                    {(meData?.data?.user?.name?.[0] || meData?.data?.user?.email?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="account-profile-name">{meData?.data?.user?.name || "User"}</h3>
                    <p className="account-profile-email">{meData?.data?.user?.email}</p>
                  </div>
                </div>
                
                <div className="account-fields">
                  <div>
                    <label className="account-mini-label">Email</label>
                    <div className="account-field-value">{meData?.data?.user?.email}</div>
                  </div>
                  <div>
                    <label className="account-mini-label">Role</label>
                    <div className="account-field-value">{meData?.data?.user?.role}</div>
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
          <div className="account-narrow">
            <h2 className="account-section-title">Security</h2>
            <div className="account-stack-lg">
              <div className="account-card">
                <h3 className="account-subheading">Change Password</h3>
                <div className="account-fields">
                  <div>
                    <label className="account-small-label">Current Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="account-small-label">New Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="account-small-label">Confirm New Password</label>
                    <Input type="password" disabled placeholder="••••••••" />
                  </div>
                  <div className="account-btn-row">
                    <Button disabled variant="outline">Update Password (Coming Soon)</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "data_controls":
         return (
          <div className="account-narrow">
            <h2 className="account-section-title">Data Controls</h2>
            <div className="account-stack-lg">
              <div className="account-card">
                <h3 className="account-card-title">Export Data</h3>
                <p className="account-card-desc">
                  Download all your conversations and account data in JSON format.
                </p>
                <Button variant="outline" disabled>Export All Data</Button>
              </div>

              <div className="account-card-danger">
                <h3 className="account-card-title-danger">Delete Account</h3>
                <p className="account-card-desc">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" disabled>Delete Account</Button>
              </div>
            </div>
          </div>
        );
      case "payment":
        return (
          <div className="account-narrow">
            <h2 className="account-section-title">Payment Methods</h2>
            <div className="account-empty-card">
              <i className="bi bi-credit-card account-empty-icon"></i>
              <p>No payment methods added yet.</p>
              <Button className="account-empty-cta" variant="outline">Add Payment Method</Button>
            </div>
          </div>
        );
      case "usage":
        return <UsageTab />;
      case "connectapp":
        return (
          <div className="account-narrow">
            <h2 className="account-section-title">Connected Apps</h2>
            <div className="account-empty-card">
               <i className="bi bi-grid account-empty-icon"></i>
              <p>You haven't connected any external applications.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="account-page">
      <div className="account-layout">
        {/* Left Sidebar */}
        <nav className="account-sidebar">
          <div className="account-sidebar-header">
            <Link
              to="/"
              className="account-back-link"
              title="Back to chat"
            >
              <i className="bi bi-arrow-left account-back-icon"></i>
            </Link>
            <h1 className="account-title">Account</h1>
          </div>
          <ul className="account-tab-list">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`account-tab-btn ${
                    activeTab === tab.id
                      ? "account-tab-btn--active"
                      : "account-tab-btn--inactive"
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
        <main className="account-content">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Account;
