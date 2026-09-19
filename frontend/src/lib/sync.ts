/**
 * sync.ts — Offline sync engine.
 *
 * Flushes the sync_queue to the server in insertion order whenever the
 * browser comes back online.  Each entry is retried up to MAX_ATTEMPTS
 * times with a simple exponential back-off delay before being discarded.
 *
 * Usage:
 *   import { flushQueue, syncStatus$ } from "@/lib/sync";
 *   await flushQueue();                         // call manually or on "online" event
 *   syncStatus$.subscribe(cb);                  // reactive status for UI
 */

import axios from "axios";
import {
  queueGetAll,
  queueDelete,
  queueBumpAttempts,
  queueCount,
  cacheDelete,
  type QueueEntry,
} from "./db";

// ─── constants ───────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;

// Cache keys to invalidate after a successful write (keyed by URL prefix)
const CACHE_INVALIDATION: Record<string, string[]> = {
  "/sales/":         ["stock-counts:", "dashboard:", "sales:"],
  "/expenses/":      ["dashboard:", "expenses:"],
  "/stock-counts/":  ["stock-counts:"],
  "/customer-payments/": ["customers:"],
};

// ─── simple event emitter for sync status ────────────────────────────────────

export type SyncState =
  | { status: "idle" }
  | { status: "syncing"; total: number; done: number }
  | { status: "done"; synced: number }
  | { status: "error"; message: string };

type Listener = (s: SyncState) => void;
const _listeners = new Set<Listener>();
let _state: SyncState = { status: "idle" };

export const syncStatus$ = {
  subscribe(fn: Listener) {
    _listeners.add(fn);
    fn(_state); // emit current state immediately
    return () => _listeners.delete(fn);
  },
};

function emit(s: SyncState) {
  _state = s;
  _listeners.forEach((fn) => fn(s));
}

// ─── lock: prevent concurrent flush runs ────────────────────────────────────

let _running = false;

// ─── back-off helper ─────────────────────────────────────────────────────────

function backoffMs(attempts: number): number {
  // 0→0ms, 1→2s, 2→4s, 3→8s, 4→16s
  return attempts === 0 ? 0 : Math.min(2 ** attempts * 1000, 30_000);
}

// ─── main flush ──────────────────────────────────────────────────────────────

/**
 * Attempt to send every entry in the sync queue to the server.
 * Safe to call multiple times — concurrent calls are serialised.
 */
export async function flushQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) return;
  if (_running) return;

  const count = await queueCount();
  if (count === 0) return;

  _running = true;
  let synced = 0;

  try {
    const entries = await queueGetAll();
    emit({ status: "syncing", total: entries.length, done: 0 });

    for (const entry of entries) {
      if (!navigator.onLine) break; // stop mid-run if connection drops

      // Respect back-off: skip entries that failed recently
      if (entry.attempts > 0) {
        const delay = backoffMs(entry.attempts);
        const age   = Date.now() - entry.createdAt;
        if (age < delay) continue;
      }

      // Discard after too many failures
      if (entry.attempts >= MAX_ATTEMPTS) {
        console.warn("[sync] Discarding entry after max attempts:", entry);
        await queueDelete(entry.id!);
        continue;
      }

      const ok = await sendEntry(entry);
      if (ok) {
        await queueDelete(entry.id!);
        await invalidateCaches(entry.url);
        synced++;
        emit({ status: "syncing", total: entries.length, done: synced });
      } else {
        await queueBumpAttempts(entry.id!);
      }
    }

    emit({ status: "done", synced });
    // Reset to idle after 4 s so the UI toast fades
    setTimeout(() => emit({ status: "idle" }), 4_000);
  } catch (err) {
    console.error("[sync] Unexpected error during flush:", err);
    emit({ status: "error", message: "Sync failed unexpectedly" });
    setTimeout(() => emit({ status: "idle" }), 5_000);
  } finally {
    _running = false;
  }
}

// ─── send a single entry ─────────────────────────────────────────────────────

async function sendEntry(entry: QueueEntry): Promise<boolean> {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";
  const token   = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    await axios({
      method:  entry.method,
      url:     `${baseURL}${entry.url}`,
      data:    entry.payload,
      headers,
      timeout: 15_000,
    });
    return true;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      // 4xx (except 429 rate-limit) are permanent failures — drop the entry
      if (status && status >= 400 && status < 500 && status !== 429) {
        console.warn(`[sync] Permanent failure (${status}) for ${entry.url}:`, err.response?.data);
        return true; // return true so it gets deleted from the queue
      }
    }
    // Network error or 5xx — will retry next flush
    return false;
  }
}

// ─── cache invalidation ──────────────────────────────────────────────────────

async function invalidateCaches(url: string): Promise<void> {
  const prefixes =
    Object.entries(CACHE_INVALIDATION).find(([prefix]) =>
      url.startsWith(prefix),
    )?.[1] ?? [];

  for (const prefix of prefixes) {
    // We don't know exact keys ahead of time — mark them stale by deleting.
    // cacheGet will return null → component re-fetches from network next load.
    await cacheDelete(prefix).catch(() => {});
  }
}

// ─── auto-flush on reconnect ─────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[sync] Network restored — flushing queue…");
    flushQueue();
  });
}
