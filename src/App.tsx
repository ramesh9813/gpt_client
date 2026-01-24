import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useMe, useSettings } from "./lib/hooks";
import { applyTheme } from "./lib/theme";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import HomeRedirect from "./pages/HomeRedirect";

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { data, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
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
    if (settings) {
      applyTheme(settings.theme, settings.accentColor, settings.fontScale);
    }
  }, [data]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
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
