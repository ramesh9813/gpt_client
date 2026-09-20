import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useMe, useSettings } from "./lib/hooks";
import { applyTheme } from "./lib/theme";
import { applyBrand, isBrandId } from "./lib/brandTheme";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Account from "./pages/Account";
import HomeRedirect from "./pages/HomeRedirect";

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { data, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
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

  useEffect(() => {
    const settings = data?.data?.settings;
    if (!settings) return;
    applyTheme(settings.theme, settings.accentColor, settings.fontScale);
    if (isBrandId((settings as { brand?: unknown }).brand)) {
      applyBrand(settings.brand);
    }
  }, [data]);

  return (
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
  );
};

export default App;
