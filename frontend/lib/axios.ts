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
  timeout: 30_000, // 30 s — prevents hanging forever if backend is slow
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

// 401 → clear tokens and redirect to login (only for non-auth endpoints)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? "";
    const isAuthEndpoint = /\/auth\/(login|register)/.test(url);
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      localStorage.getItem("access_token") &&
      !isAuthEndpoint
    ) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      document.cookie = "access_token=; path=/; max-age=0";
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
