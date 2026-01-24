import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { apiFetch } from "../lib/api";
import { useMe } from "../lib/hooks";

const Account = () => {
  const { data } = useMe();
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Account</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">Manage your profile.</p>
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="text-sm">Email: {data?.data?.user?.email}</div>
          <div className="text-sm">Name: {data?.data?.user?.name || "-"}</div>
          <div className="text-sm">Role: {data?.data?.user?.role}</div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Link to="/settings">
            <Button variant="outline">Settings</Button>
          </Link>
          <Button onClick={logout} disabled={loading}>
            {loading ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Account;
