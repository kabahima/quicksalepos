/**
 * api.ts — Axios client with offline-aware interceptors.
 *
 * Request interceptor  — attaches the Bearer token from localStorage.
 * Response interceptor — handles 401 (redirect to login unless offline)
 *                        and network errors (queue the request for later sync
 *                        if it is a mutating method and the device is offline).
 */

import axios, { type AxiosRequestConfig } from "axios";
import { queuePush } from "./db";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL || "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── request: attach auth token ──────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── response: 401 handling + offline queue ───────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isOffline =
      typeof navigator !== "undefined" && !navigator.onLine;

    // ── 401: only redirect to login when actually online ──────────────────
    if (error.response?.status === 401) {
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !isOffline
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_role");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // ── Network error while offline: queue mutating requests ─────────────
    const cfg: AxiosRequestConfig = error.config ?? {};
    const method = (cfg.method ?? "").toUpperCase();
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

    if (!error.response && isOffline && isMutation && cfg.url) {
      // Normalise URL to be relative (strip baseURL prefix if present)
      const baseURL = (cfg.baseURL ?? API_URL ?? "/api").replace(/\/$/, "");
      const rawUrl  = cfg.url ?? "";
      const relativeUrl = rawUrl.startsWith(baseURL)
        ? rawUrl.slice(baseURL.length)
        : rawUrl;

      // Parse payload
      let payload: unknown = cfg.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch {}
      }

      // Build a human-readable label from the URL
      const label = urlToLabel(relativeUrl);

      try {
        await queuePush({
          method:  method as import("./db").HttpMethod,
          url:     relativeUrl,
          payload,
          label,
          localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        console.info(`[offline] Queued ${method} ${relativeUrl}`);
      } catch (qErr) {
        console.error("[offline] Failed to queue request:", qErr);
      }

      // Return a synthetic "offline" rejection the caller can detect
      const offlineError = Object.assign(new Error("offline"), {
        isOfflineQueued: true,
        label,
      });
      return Promise.reject(offlineError);
    }

    return Promise.reject(error);
  },
);

// ─── helper: label from URL ───────────────────────────────────────────────────


// ─── helper: label from URL ───────────────────────────────────────────────────

function urlToLabel(url: string): string {
  const segment = url.replace(/^\/|\/$/g, "").split("/")[0] ?? url;
  const map: Record<string, string> = {
    "sales":              "Sale",
    "expenses":           "Expense",
    "stock-counts":       "Stock entry",
    "customer-payments":  "Customer payment",
    "customers":          "Customer",
    "suppliers":          "Supplier",
    "product-categories": "Category",
    "brands":             "Brand",
    "receipts":           "Receipt",
  };
  return map[segment] ?? segment;
}

export default api;
