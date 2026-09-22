import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse } from "./lib/api";
import { type OpenRouterModel } from "./features/chat/hooks/modelCache";
import { useMe, useSettings } from "./lib/hooks";
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
  const { data, isLoading } = useMe();
  const location = useLocation();

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
