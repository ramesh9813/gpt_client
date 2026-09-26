import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { apiFetch, type ApiResponse } from "../../lib/api";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "user";
  createdAt: string;
  lastLoginAt: string | null;
};

// Owner-only console: search users and promote/demote between the general
// "user" role and "admin". Owner-pinned accounts can't be changed here.
export const AdminUsersTab = ({ selfId }: { selfId?: string }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () =>
      apiFetch<ApiResponse<{ users: AdminUser[] }>>(
        `/api/admin/users?search=${encodeURIComponent(search)}`
      ),
    staleTime: 1000 * 15,
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; role: "user" | "admin" }) =>
      apiFetch(`/api/admin/users/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: vars.role }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = data?.data?.users ?? [];

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">Users</h2>
      <p className="account-card-desc">
        Promote a general user to admin (gives access to the built-in default
        models) or demote an admin back to a general user. Owner-pinned
        accounts can't be changed here.
      </p>
      <div className="account-stack-lg">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          aria-label="Search users"
        />
        {isLoading ? (
          <span className="account-check-hint">Loading users…</span>
        ) : isError ? (
          <span className="account-check-hint">Could not load users.</span>
        ) : users.length === 0 ? (
          <span className="account-check-hint">No users found.</span>
        ) : (
          <div className="admin-user-list">
            {users.map((u) => (
              <div key={u.id} className="account-card admin-user-row">
                <div className="admin-user-info">
                  <div className="account-profile-name">{u.name || u.email}</div>
                  <div className="account-profile-email">{u.email}</div>
                </div>
                {u.role === "owner" || u.id === selfId ? (
                  <span className="admin-user-role-pill">owner</span>
                ) : (
                  <select
                    className="account-select admin-user-role-select"
                    value={u.role}
                    disabled={mutation.isPending}
                    aria-label={`Role for ${u.email}`}
                    onChange={(e) =>
                      mutation.mutate({
                        id: u.id,
                        role: e.target.value as "user" | "admin",
                      })
                    }
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
        {mutation.isError ? (
          <span className="account-check-hint">
            Role update failed. Only owners can change roles.
          </span>
        ) : null}
        {mutation.isSuccess ? (
          <span className="byok-key-status byok-key-status--ok">
            Role updated.
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["admin-users"] })
          }
        >
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default AdminUsersTab;
