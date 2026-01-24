import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, ApiResponse } from "../../lib/api";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Dropdown } from "../../components/Dropdown";
import { Modal } from "../../components/Modal";
import { IconButton } from "../../components/IconButton";
import { useMe } from "../../lib/hooks";

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

const ConversationSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const { data: meData } = useMe();
  
  const user = meData?.data?.user;
  const initial = (user?.name?.[0] || user?.email?.[0] || "?").toUpperCase();

  const { data } = useQuery({
    queryKey: ["conversations", search],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: Conversation[] }>>(
        `/api/conversations?search=${encodeURIComponent(search)}`
      )
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        "/api/conversations",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/c/${res.data.conversation.id}`);
    }
  });

  const renameMutation = useMutation({
    mutationFn: (payload: { id: string; title: string }) =>
      apiFetch<ApiResponse<{ conversation: Conversation }>>(
        `/api/conversations/${payload.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: payload.title })
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ApiResponse<{}>>(`/api/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (params.conversationId === menuOpen) {
        navigate("/");
      }
    }
  });

  const allConversations = useMemo(() => {
    const items = data?.data?.items || [];
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const renameSchema = useMemo(
    () => z.string().min(1, "Title is required").max(80, "Max 80 characters"),
    []
  );

  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  return (
    <aside
      className={`flex h-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-all duration-200 ${
        collapsed ? "w-14" : "w-72"
      }`}
    >
      <div
        className={`flex items-center justify-between ${
          collapsed ? "px-2 py-2" : "px-3 py-3"
        }`}
      >
        {!collapsed && (
          <Button
            className="flex-1 justify-start gap-2 border-0 bg-transparent hover:bg-[var(--panel)] px-2 text-black dark:text-white"
            onClick={() => createMutation.mutate()}
          >
            <i className="bi bi-plus-lg text-base"></i>
            <span>New chat</span>
          </Button>
        )}
        <IconButton
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-8 w-8 !border-0"
        >
          <i className="bi bi-layout-sidebar-inset text-base"></i>
        </IconButton>
      </div>
      {collapsed ? (
        <div className="relative flex flex-1 flex-col items-center gap-1 py-3">
          <IconButton
            onClick={() => createMutation.mutate()}
            aria-label="New chat"
            title="New chat"
            className="h-9 w-9"
          >
            <span className="text-lg">+</span>
          </IconButton>
          <div className="relative" ref={searchRef}>
            <IconButton
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Search conversations"
              title="Search conversations"
              className="h-9 w-9"
            >
              <i className="bi bi-search text-base"></i>
            </IconButton>
            {searchOpen ? (
              <div className="absolute left-full top-0 z-20 ml-2 w-56">
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="bg-[var(--panel)] border-0"
                />
              </div>
            ) : null}
          </div>
          <div className="flex-1 w-full overflow-y-auto px-2 pb-3 scrollbar-thin">
            <div className="space-y-2">
              {allConversations.map((conversation) => {
                const active = params.conversationId === conversation.id;
                const compact = conversation.title
                  .trim()
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <button
                    key={conversation.id}
                    className={`h-9 w-full rounded-lg text-xs font-semibold ${
                      active
                        ? "bg-[var(--panel)] text-[var(--text)]"
                        : "text-[var(--text)] hover:bg-[var(--panel)]"
                    }`}
                    onClick={() => navigate(`/c/${conversation.id}`)}
                    title={conversation.title}
                  >
                    {compact || "??"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-auto pb-3">
            <Link to="/account" title="Account">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-sm font-medium text-white shadow-sm hover:bg-purple-700">
                {initial}
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="px-3 pb-2">
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]"></i>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="bg-transparent border-0 pl-9 focus:ring-0"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
            <div className="mb-4">
              <div className="mb-2 px-2 text-sm font-bold font-sans text-[var(--text)]">
                History
              </div>
              <div className="space-y-1">
                {allConversations.map((conversation) => {
                  const active = params.conversationId === conversation.id;
                  return (
                    <div
                      key={conversation.id}
                      className={`group flex items-center justify-between rounded-lg px-2 py-2 text-sm ${
                        active
                          ? "bg-[var(--panel)] text-[var(--text)]"
                          : "text-[var(--text)] hover:bg-[var(--panel)]"
                      }`}
                    >
                      <button
                        className="flex-1 text-left overflow-hidden whitespace-normal h-5 leading-5 font-sans"
                        onClick={() => navigate(`/c/${conversation.id}`)}
                        title={conversation.title}
                      >
                        {conversation.title}
                      </button>
                      <div
                        className={`relative h-6 w-6 ${menuOpen === conversation.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                        onMouseLeave={() => setMenuOpen(null)}
                      >
                        <IconButton
                          onClick={() =>
                            setMenuOpen((prev) =>
                              prev === conversation.id ? null : conversation.id
                            )
                          }
                          aria-label="Conversation menu"
                          className="!border-0 !h-6 !w-6"
                        >
                          <i className="bi bi-three-dots"></i>
                        </IconButton>
                        {/* Invisible bridge to prevent menu from closing when moving mouse across the gap */}
                        {menuOpen === conversation.id && (
                          <div className="absolute top-full left-0 w-full h-2 bg-transparent z-30" />
                        )}
                        <Dropdown 
                          open={menuOpen === conversation.id} 
                          className="mt-0" // Remove default margin to reduce gap
                        >
                          <button
                            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--sidebar)]"
                            onClick={() => {
                              setRenameId(conversation.id);
                              setRenameTitle(conversation.title);
                              setRenameError(null);
                              setMenuOpen(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-[var(--sidebar)]"
                            onClick={() => {
                              deleteMutation.mutate(conversation.id);
                              setMenuOpen(null);
                            }}
                          >
                            Delete
                          </button>
                        </Dropdown>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--border)] px-4 py-3">
            <Link to="/account" className="flex items-center gap-3 hover:text-[var(--text)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-medium text-white shadow-sm">
                {initial}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name || "User"}</span>
                <span className="text-[10px] text-[var(--muted)]">{user?.email}</span>
              </div>
            </Link>
          </div>
        </div>
      )}
      <Modal

        open={!!renameId}
        title="Rename conversation"
        onClose={() => {
          setRenameId(null);
          setRenameError(null);
        }}
      >
        <div className="space-y-3">
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
          />
          {renameError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
              {renameError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameId) {
                  const validation = renameSchema.safeParse(renameTitle.trim());
                  if (!validation.success) {
                    setRenameError(
                      validation.error.errors[0]?.message || "Invalid title"
                    );
                    return;
                  }
                  setRenameError(null);
                  renameMutation.mutate({
                    id: renameId,
                    title: renameTitle.trim()
                  });
                  setRenameId(null);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
};

export default ConversationSidebar;
