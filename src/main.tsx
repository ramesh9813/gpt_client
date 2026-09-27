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

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const showFatalError = (err: unknown) => {
  try {
    const root = document.getElementById("root");
    if (!root) return;
    if (root.childElementCount > 0) return;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const message = escapeHtml(String(rawMessage)).slice(0, 2000);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("style", "padding:24px;font-family:system-ui,sans-serif;color:#0d0d0d;background:#fff");
    const h1 = document.createElement("h1");
    h1.setAttribute("style", "font-size:18px;margin:0 0 8px");
    h1.textContent = "App failed to load";
    const p = document.createElement("p");
    p.setAttribute("style", "font-size:14px;margin:0 0 8px");
    p.textContent = "Check console for details. If you just pulled, rebuild the client.";
    const pre = document.createElement("pre");
    pre.setAttribute("style", "font-size:12px;white-space:pre-wrap;opacity:.7");
    pre.textContent = rawMessage.slice(0, 2000);
    wrapper.appendChild(h1);
    wrapper.appendChild(p);
    wrapper.appendChild(pre);
    root.replaceChildren(wrapper);
    void message;
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
