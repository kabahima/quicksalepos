/**
 * db.ts — lightweight IndexedDB wrapper (no external dependency).
 *
 * Two stores:
 *   cache        — read-side cache for API GET responses (keyed by cache key string)
 *   sync_queue   — ordered queue of offline write operations waiting to be synced
 */

const DB_NAME    = "quicksale_offline";
const DB_VERSION = 1;

export interface CacheEntry {
  key: string;            // e.g. "stock-counts:1", "businesses"
  data: unknown;
  ts: number;             // Date.now() when cached
}

export type HttpMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export interface QueueEntry {
  id?: number;            // IDB auto-increment key
  method: HttpMethod;
  url: string;            // relative URL e.g. "/sales/"
  payload: unknown;
  createdAt: number;      // Date.now()
  attempts: number;       // how many sync attempts have failed
  label: string;          // human-readable e.g. "Sale · 3 items"
  localId: string;        // uuid-style local identifier, returned to caller
}

// ─── open / upgrade ──────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        const qs = db.createObjectStore("sync_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        qs.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db!);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── generic helpers ─────────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ─── CACHE API ───────────────────────────────────────────────────────────────

/** Write (or overwrite) a cache entry. */
export async function cacheSet(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  await wrap(tx(db, "cache", "readwrite").put({ key, data, ts: Date.now() }));
}

/** Read a cache entry. Returns null if not found or older than maxAgeMs. */
export async function cacheGet<T = unknown>(
  key: string,
  maxAgeMs = 24 * 60 * 60 * 1000, // 24 h default
): Promise<T | null> {
  const db = await openDB();
  const entry: CacheEntry | undefined = await wrap(
    tx(db, "cache", "readonly").get(key),
  );
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data as T;
}

/** Delete a cache entry (call after successful sync to invalidate stale data). */
export async function cacheDelete(key: string): Promise<void> {
  const db = await openDB();
  await wrap(tx(db, "cache", "readwrite").delete(key));
}

// ─── QUEUE API ───────────────────────────────────────────────────────────────

/** Add a write operation to the sync queue. Returns the new entry id. */
export async function queuePush(
  entry: Omit<QueueEntry, "id" | "attempts" | "createdAt">,
): Promise<number> {
  const db = await openDB();
  const id = await wrap<IDBValidKey>(
    tx(db, "sync_queue", "readwrite").add({
      ...entry,
      attempts: 0,
      createdAt: Date.now(),
    }),
  );
  return id as number;
}

/** Return all queued entries in insertion order. */
export async function queueGetAll(): Promise<QueueEntry[]> {
  const db = await openDB();
  return wrap<QueueEntry[]>(
    tx(db, "sync_queue", "readonly").index("createdAt").getAll(),
  );
}

/** Remove a successfully synced entry from the queue. */
export async function queueDelete(id: number): Promise<void> {
  const db = await openDB();
  await wrap(tx(db, "sync_queue", "readwrite").delete(id));
}

/** Increment the attempt counter on a failed entry (for exponential back-off). */
export async function queueBumpAttempts(id: number): Promise<void> {
  const db = await openDB();
  const store = tx(db, "sync_queue", "readwrite");
  const entry: QueueEntry = await wrap(store.get(id));
  if (entry) {
    await wrap(store.put({ ...entry, attempts: entry.attempts + 1 }));
  }
}

/** How many entries are waiting in the queue. */
export async function queueCount(): Promise<number> {
  const db = await openDB();
  return wrap<number>(tx(db, "sync_queue", "readonly").count());
}
