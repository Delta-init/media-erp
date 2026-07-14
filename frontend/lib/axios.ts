import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// In a browser preview context, use the Next.js proxy (/api/v1) to avoid
// CORS — the proxy rewrites to the real backend server-side.
// In production (same-origin or CORS-enabled deployment), use the full URL.
const _configuredUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const baseURL =
  typeof window !== "undefined" &&
  !_configuredUrl.includes("localhost") &&
  window.location.hostname === "localhost"
    ? "/api/v1"
    : _configuredUrl;

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
  timeout: 30_000,
});

// Attach bearer token from localStorage on every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Token refresh state — prevents concurrent 401s from firing multiple refresh calls
let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

function _flushQueue(token: string) {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
}

function _clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  document.cookie = "access_token=; path=/; max-age=0";
  // Clear Zustand store without importing the hook (avoids hook rules)
  try {
    const { useAuthStore } = require("@/stores/authStore");
    useAuthStore.getState().clearAuth();
  } catch {
    // store not yet initialised — tokens already removed above
  }
  window.location.href = "/login";
}

// 401 → attempt token refresh, then retry original request
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest?.url ?? "";

    // Don't intercept auth endpoints or already-retried requests
    const isAuthEndpoint = /\/auth\/(login|register|refresh)/.test(url);
    if (
      error.response?.status !== 401 ||
      isAuthEndpoint ||
      originalRequest._retry ||
      typeof window === "undefined"
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      _clearAuth();
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request until it resolves
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _refreshQueue.push((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
        // If refresh ultimately fails the queue will be cleared in the catch below
        void reject; // TypeScript: suppress unused-variable warning
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { "Content-Type": "application/json" } },
      );

      const newAccess: string = data.data.access_token;
      const newRefresh: string = data.data.refresh_token;
      const user = data.data.user;

      // Persist new tokens
      localStorage.setItem("access_token", newAccess);
      localStorage.setItem("refresh_token", newRefresh);
      document.cookie = `access_token=${newAccess}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      // Update Zustand store so UI reflects any user changes
      try {
        const { useAuthStore } = require("@/stores/authStore");
        useAuthStore.getState().setAuth(user, newAccess, newRefresh);
      } catch {
        // store not yet initialised — tokens already persisted above
      }

      // Flush queued requests with the new token
      _flushQueue(newAccess);

      // Retry the original request
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch {
      // Refresh failed — session truly expired
      _refreshQueue = [];
      _clearAuth();
      return Promise.reject(error);
    } finally {
      _isRefreshing = false;
    }
  },
);

export default api;
