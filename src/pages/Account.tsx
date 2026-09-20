import "./Account.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { apiFetch, clearAuthStorage } from "../lib/api";
import { useMe } from "../lib/hooks";
import { SettingsTab } from "../features/account/SettingsTab";
import { UsageTab } from "../features/account/UsageTab";

export type Tab = "profile" | "settings" | "security" | "data_controls" | "payment" | "usage" | "connectapp";

export type AccountTab = Tab;

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
