const API_BASE = import.meta.env.VITE_API_URL || "";

let refreshPromise: Promise<boolean> | null = null;

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
      credentials: "include"
    })
      .then((res) => res.ok)
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
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
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

  return (json || ({} as T)) as T;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: unknown;
  error?: { code: string; message: string; details?: unknown };
};
