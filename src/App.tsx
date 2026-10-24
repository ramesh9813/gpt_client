import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse, getApiBase, getCsrfToken, getInMemoryAccessToken, refreshSessionNow } from "./lib/api";
import { type OpenRouterModel } from "./features/chat/hooks/modelCache";
import { getCachedMeForShell, useMe, useSettings } from "./lib/hooks";
import { applyTheme, clampAppFontSize, clampIconScale } from "./lib/theme";
import { applyBrand, isBrandId } from "./lib/brandTheme";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import HomeRedirect from "./pages/HomeRedirect";

// Heavy routes split out so first paint (login/shell) never downloads the
// chat thread (markdown, code highlight, export libs) or account charts.
const Chat = lazy(() => import("./pages/Chat"));
const Account = lazy(() => import("./pages/Account"));

const RouteFallback = () => (
  <div className="app-loading" role="status" aria-label="Loading">
    <span className="loading-dots" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
  </div>
);

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { data, isLoading, error } = useMe();
  const location = useLocation();
  // Step 1: instant shell from local cache while /api/me validates in bg.
  const [cachedUser] = useState(() => getCachedMeForShell());
  const unauthorized =
    (error as { error?: { code?: string } } | null | undefined)?.error?.code ===
    "UNAUTHORIZED";

  // With the cached identity seeding useMe, data is populated instantly —
  // but a confirmed auth rejection must still end the session, so the
  // unauthorized gate applies to the seeded data too.
  if (data?.data?.user && !unauthorized) {
    return children;
  }

  // Background validation: paint the cached shell immediately, don't block
  // first paint on the network. Cold boots, proxy 5xx and offline reloads
  // must not bounce an already logged-in browser to /login. Only a confirmed
  // auth rejection ends the cached session.
  if (cachedUser && !unauthorized) {
    return children;
  }

  if (isLoading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading">
        <span className="loading-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    );
  }

  if (!data?.data?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App = () => {
  const location = useLocation();
  const authEnabled = !["/login", "/signup"].includes(location.pathname);
  const { data: meData } = useMe(authEnabled);
  const { data } = useSettings(!!meData?.data?.user);
  const queryClient = useQueryClient();

  // Dynamically load all available OpenRouter models on app load.
  // Deferred to idle so the model catalog never contends with auth +
  // conversation fetches on slow first loads.
  useEffect(() => {
    const prefetch = () => {
      void queryClient.prefetchQuery({
        queryKey: ["models"],
        queryFn: () =>
          apiFetch<ApiResponse<{ models: OpenRouterModel[] }>>("/api/models"),
        staleTime: 1000 * 60 * 5,
      });
    };
    try {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof w.requestIdleCallback === "function") {
        const id = w.requestIdleCallback(prefetch, { timeout: 3000 });
        return () => w.cancelIdleCallback?.(id);
      }
    } catch {
      // fall through to timeout
    }
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, [queryClient]);

  useEffect(() => {
    const settings = data?.data?.settings;
    if (!settings) return;
    applyTheme(
      settings.theme,
      settings.fontScale,
      clampAppFontSize(settings.appFontSize),
      clampIconScale(settings.iconScale)
    );
    if (isBrandId((settings as { brand?: unknown }).brand)) {
      applyBrand(settings.brand);
    }
  }, [data]);

  // Cold-open readiness: wake the hibernating free-tier backend the moment
  // the app loads so its boot overlaps with the first real requests instead
  // of serializing in front of them, and pre-warm the session refresh when a
  // previous session exists — /api/me then skips its 401 → refresh → retry
  // chain. Fire-and-forget on every route (the login POST lands on a warm
  // server too).
  useEffect(() => {
    try {
      void fetch(`${getApiBase()}/api/health`, {
        credentials: "include",
      }).catch(() => {});
    } catch {
      // ignore — the real request will surface any outage
    }
    if (!getInMemoryAccessToken() && getCsrfToken()) {
      void refreshSessionNow();
    }
  }, []);

  // Coming back after being away: wake the hibernated free-tier backend and
  // silently refresh the session BEFORE the next prompt, so the first
  // message back neither waits on a cold boot nor fails with
  // "Missing access token". Fire-and-forget, auth pages excluded.
  useEffect(() => {
    let lastActive = Date.now();
    const WAKE_AFTER_MS = 120_000;
    const poke = () => {
      if (document.visibilityState !== "visible") {
        lastActive = Date.now();
        return;
      }
      const away = Date.now() - lastActive;
      lastActive = Date.now();
      if (away < WAKE_AFTER_MS) return;
      if (["/login", "/signup"].includes(window.location.pathname)) return;
      try {
        void fetch(`${getApiBase()}/api/health`, {
          credentials: "include",
        }).catch(() => {});
      } catch {
        // ignore — the real request will surface any outage
      }
      // apiFetch refreshes the session on 401 automatically.
      void apiFetch("/api/me").catch(() => {});
    };
    document.addEventListener("visibilitychange", poke);
    window.addEventListener("focus", poke);
    return () => {
      document.removeEventListener("visibilitychange", poke);
      window.removeEventListener("focus", poke);
    };
  }, []);

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/settings"
        element={<Navigate to="/account" replace />}
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />
      <Route
        path="/c/:conversationId"
        element={
          <RequireAuth>
            <Chat />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeRedirect />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default App;
