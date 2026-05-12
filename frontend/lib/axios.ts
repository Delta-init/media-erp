import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});


// Attach bearer token from localStorage on every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    console.log("api calling")
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log("api calling", config)
  }
  return config;
});

// 401 → clear tokens and redirect to login, but only when a session token exists
// AND the 401 did not come from an auth endpoint (login/register 401s are expected
// wrong-credentials responses that the mutation's onError should handle).
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
    console.log("api calling", error)
    return Promise.reject(error);
  }
);

export default api;
