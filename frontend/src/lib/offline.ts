/**
 * offline.ts — React hooks and helpers for offline-aware components.
 *
 * Exports:
 *   useOnlineStatus()        → boolean (true = online)
 *   useQueueCount()          → number of pending offline operations
 *   useSyncStatus()          → current SyncState from sync engine
 *   queueWrite(...)          → enqueue a write; resolves with a localId
 *   withCache(key, fetcher)  → try IDB cache first, then network, then throw
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { cacheGet, cacheSet, queuePush, queueCount } from "./db";
import { syncStatus$, flushQueue, type SyncState } from "./sync";
import type { HttpMethod, QueueEntry } from "./db";

// ─── useOnlineStatus ─────────────────────────────────────────────────────────

/**
 * Reactively tracks navigator.onLine and the browser "online"/"offline" events.
 * Returns true when the browser believes it has a network connection.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online",  up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

// ─── useQueueCount ───────────────────────────────────────────────────────────

/**
 * Returns the current number of operations waiting in the sync queue.
 * Re-reads from IDB whenever the window comes back online or on a short poll.
 */
export function useQueueCount(): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      setCount(await queueCount());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 5 s so the count stays fresh after background syncs
    const t = setInterval(refresh, 5_000);
    window.addEventListener("online",  refresh);
    window.addEventListener("offline", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("online",  refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [refresh]);

  return count;
}

// ─── useSyncStatus ───────────────────────────────────────────────────────────

/** Subscribes to the sync engine's status stream for toast/banner display. */
export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  useEffect(() => {
    const unsub = syncStatus$.subscribe(setState);
    return () => { unsub(); };
  }, []);

  return state;
}

// ─── queueWrite ──────────────────────────────────────────────────────────────

/**
 * Push a write operation into the offline queue.
 * Returns a unique localId (used as a temporary placeholder receipt number etc.)
 */
export async function queueWrite(
  op: Omit<QueueEntry, "id" | "attempts" | "createdAt" | "localId">,
): Promise<{ localId: string; queueId: number }> {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const queueId = await queuePush({ ...op, localId });
  return { localId, queueId };
}

// ─── withCache ───────────────────────────────────────────────────────────────

/**
 * Try to serve data from IDB cache first.
 * If cache is empty or stale, fetch from network, write back to cache, and return.
 * If both cache and network fail, throws.
 *
 * @param key      IDB cache key
 * @param fetcher  async function that calls the network (should return the data to cache)
 * @param maxAgeMs how long a cached entry is considered fresh (default 24 h)
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs = 24 * 60 * 60 * 1000,
): Promise<{ data: T; fromCache: boolean }> {
  // 1. Try cache
  try {
    const cached = await cacheGet<T>(key, maxAgeMs);
    if (cached !== null) {
      // Refresh in the background so cache stays warm without blocking the UI
      fetcher()
        .then((fresh) => cacheSet(key, fresh))
        .catch(() => {/* silent — we already served from cache */});
      return { data: cached, fromCache: true };
    }
  } catch {}

  // 2. Fetch from network
  const data = await fetcher();
  try {
    await cacheSet(key, data);
  } catch {}
  return { data, fromCache: false };
}

// ─── manual flush trigger ────────────────────────────────────────────────────

/** Trigger a manual sync flush (e.g. from a "Sync now" button). */
export async function triggerSync(): Promise<void> {
  await flushQueue();
}
