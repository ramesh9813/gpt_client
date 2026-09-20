import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./theme/brands.css";
import { initTheme } from "./lib/theme";
import { BrandThemeProvider, initBrand } from "./lib/brandTheme";

initTheme();
initBrand();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
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
