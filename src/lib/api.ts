const API_BASE = import.meta.env.VITE_API_URL || "";

// Base URL of the API server ("" = same origin). Exported for flows that
// need a real top-level navigation (OAuth authorize) rather than fetch.
export const getApiBase = () => API_BASE;

let refreshPromise: Promise<boolean> | null = null;

// In-memory bearer cache (never localStorage): seeded from httpOnly cookies
// conceptually, but we keep it only for the Authorization header fallback
// when a request needs it before a refresh. Cleared on logout/refresh failure.
let inMemoryAccessToken = "";

export const getInMemoryAccessToken = () => inMemoryAccessToken;
export const setInMemoryAccessToken = (token: string) => {
  inMemoryAccessToken = token;
};

// Back-compat shims: old code may import these names. They are now no-ops
// or in-memory only — tokens never touch localStorage.
export const getStoredAccessToken = () => inMemoryAccessToken;
export const setStoredAccessToken = (token: string) => {
  inMemoryAccessToken = token;
};
export const getStoredRefreshToken = () => "";
export const setStoredRefreshToken = (_token: string) => {};
export const getStoredCsrfToken = () => "";
export const setStoredCsrfToken = (_token: string) => {};
export const clearAuthStorage = () => {
  inMemoryAccessToken = "";
};
export const saveAuthTokens = (tokens?: {
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
}) => {
  if (!tokens) return;
  if (tokens.accessToken) inMemoryAccessToken = tokens.accessToken;
  // refreshToken/csrfToken are httpOnly cookies — not stored in JS
};

export const getCsrfToken = () => {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrfToken="));
  return match ? match.split("=")[1] : "";
};

const shouldSendCsrf = (method?: string) => {
  const safe = ["GET", "HEAD", "OPTIONS"];
  return method ? !safe.includes(method.toUpperCase()) : false;
};

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // no body — refresh uses httpOnly cookie
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          clearAuthStorage();
          return false;
        }
        const text = await res.text();
        const json = safeJsonParse(text);
        if (json?.data?.tokens?.accessToken) {
          setInMemoryAccessToken(json.data.tokens.accessToken);
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
  if (inMemoryAccessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
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
      credentials: "include",
    });
  } catch {
    throw {
      error: {
        message:
          "Network error. Check that the server is running and CORS is allowed.",
      },
    };
  }

  const isAuthRoute = path.includes("/api/auth/");

  if (response.status === 401 && !isAuthRoute) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers || {});
      if (inMemoryAccessToken && !retryHeaders.has("Authorization")) {
        retryHeaders.set("Authorization", `Bearer ${inMemoryAccessToken}`);
      }
      if (shouldSendCsrf(init.method)) {
        const csrf = getCsrfToken();
        if (csrf) retryHeaders.set("x-csrf-token", csrf);
      }
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });
      const retryText = await retry.text();
      const retryJson = safeJsonParse(retryText);
      if (!retry.ok) {
        throw (
          retryJson || {
            error: { message: retryText || retry.statusText },
          }
        );
      }
      if (retryJson?.data?.tokens?.accessToken) {
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
        error: { message: text || response.statusText },
      }
    );
  }

  if (json?.data?.tokens?.accessToken) {
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
