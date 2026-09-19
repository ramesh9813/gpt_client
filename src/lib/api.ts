const API_BASE = import.meta.env.VITE_API_URL || "";

let refreshPromise: Promise<boolean> | null = null;

export const getStoredAccessToken = () =>
  localStorage.getItem("accessToken") || "";
export const setStoredAccessToken = (token: string) =>
  localStorage.setItem("accessToken", token);
export const getStoredRefreshToken = () =>
  localStorage.getItem("refreshToken") || "";
export const setStoredRefreshToken = (token: string) =>
  localStorage.setItem("refreshToken", token);
export const getStoredCsrfToken = () =>
  localStorage.getItem("csrfToken") || "";
export const setStoredCsrfToken = (token: string) =>
  localStorage.setItem("csrfToken", token);

export const clearAuthStorage = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("csrfToken");
};

export const saveAuthTokens = (tokens?: {
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
}) => {
  if (!tokens) return;
  if (tokens.accessToken) setStoredAccessToken(tokens.accessToken);
  if (tokens.refreshToken) setStoredRefreshToken(tokens.refreshToken);
  if (tokens.csrfToken) setStoredCsrfToken(tokens.csrfToken);
};

export const getCsrfToken = () => {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrfToken="));
  return (match ? match.split("=")[1] : "") || getStoredCsrfToken();
};

const shouldSendCsrf = (method?: string) => {
  const safe = ["GET", "HEAD", "OPTIONS"];
  return method ? !safe.includes(method.toUpperCase()) : false;
};

const refreshSession = async () => {
  if (!refreshPromise) {
    const refreshToken = getStoredRefreshToken();
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken }),
      credentials: "include"
    })
      .then(async (res) => {
        if (!res.ok) {
          clearAuthStorage();
          return false;
        }
        const text = await res.text();
        const json = safeJsonParse(text);
        if (json?.data?.tokens) {
          saveAuthTokens(json.data.tokens);
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const apiFetch = async <T>(
  path: string,
  init: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(init.headers || {});
  const token = getStoredAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (shouldSendCsrf(init.method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set("x-csrf-token", csrf);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include"
    });
  } catch {
    throw {
      error: {
        message:
          "Network error. Check that the server is running and CORS is allowed."
      }
    };
  }

  const isAuthRoute = path.includes("/api/auth/");

  if (response.status === 401 && !isAuthRoute) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers || {});
      const newToken = getStoredAccessToken();
      if (newToken && !retryHeaders.has("Authorization")) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      }
      if (shouldSendCsrf(init.method)) {
        const csrf = getCsrfToken();
        if (csrf) retryHeaders.set("x-csrf-token", csrf);
      }
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: "include"
      });
      const retryText = await retry.text();
      const retryJson = safeJsonParse(retryText);
      if (!retry.ok) {
        throw (
          retryJson || {
            error: { message: retryText || retry.statusText }
          }
        );
      }
      if (retryJson?.data?.tokens) {
        saveAuthTokens(retryJson.data.tokens);
      }
      return (retryJson || ({} as T)) as T;
    }
  }

  const text = await response.text();
  const json = safeJsonParse(text);

  if (!response.ok) {
    throw (
      json || {
        error: { message: text || response.statusText }
      }
    );
  }

  if (json?.data?.tokens) {
    saveAuthTokens(json.data.tokens);
  }

  return (json || ({} as T)) as T;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: unknown;
  error?: { code: string; message: string; details?: unknown };
};
