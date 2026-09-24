import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./theme/brands.css";
import "./loading-dots.css";
import { initTheme } from "./lib/theme";
import { BrandThemeProvider, initBrand } from "./lib/brandTheme";

const showFatalError = (err: unknown) => {
  try {
    const root = document.getElementById("root");
    if (!root) return;
    // Only show fallback if React never mounted anything.
    if (root.childElementCount > 0) return;
    const message = err instanceof Error ? err.message : String(err);
    root.innerHTML =
      '<div style="padding:24px;font-family:system-ui,sans-serif;color:#0d0d0d;background:#fff">' +
      "<h1 style='font-size:18px;margin:0 0 8px'>App failed to load</h1>" +
      "<p style='font-size:14px;margin:0 0 8px'>Check console for details. If you just pulled, rebuild the client.</p>" +
      "<pre style='font-size:12px;white-space:pre-wrap;opacity:.7'>" +
      String(message).replace(/</g, "&lt;") +
      "</pre></div>";
  } catch {
    /* ignore */
  }
};

window.addEventListener("error", (e) => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) =>
  showFatalError(e.reason)
);

try {
  initTheme();
} catch (e) {
  console.error("initTheme failed", e);
}
try {
  initBrand();
} catch (e) {
  console.error("initBrand failed", e);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Two-step load: keep DB truth around so remounts paint from cache
      // while background refetches refresh silently.
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 10,
    }
  }
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found in index.html");
}

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <BrandThemeProvider>
            <App />
          </BrandThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
} catch (e) {
  console.error(e);
  showFatalError(e);
}
