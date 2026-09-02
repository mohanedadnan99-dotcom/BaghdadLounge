export type OfflineMutationStatus = "pending" | "syncing" | "conflict" | "failed";

export type OfflineEntryMutation = {
  clientMutationId: string;
  createdAt: string;
  status: OfflineMutationStatus;
  attempts: number;
  lastError: string;
  payload: Record<string, unknown>;
};

const DB_NAME = "baghdad-lounge-operations";
const DB_VERSION = 1;
const FALLBACK_OUTBOX = "baghdad_ops_offline_outbox_v1";
const FALLBACK_CACHE = "baghdad_ops_offline_cache_v1";

function hasBrowserStorage() {
  return typeof window !== "undefined";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!hasBrowserStorage() || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "clientMutationId" });
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function fallbackOutbox() {
  if (!hasBrowserStorage()) return [] as OfflineEntryMutation[];
  try { return JSON.parse(localStorage.getItem(FALLBACK_OUTBOX) || "[]") as OfflineEntryMutation[]; }
  catch { return []; }
}

function writeFallbackOutbox(items: OfflineEntryMutation[]) {
  if (!hasBrowserStorage()) return;
  localStorage.setItem(FALLBACK_OUTBOX, JSON.stringify(items));
}

function fallbackCache() {
  if (!hasBrowserStorage()) return {} as Record<string, unknown>;
  try { return JSON.parse(localStorage.getItem(FALLBACK_CACHE) || "{}") as Record<string, unknown>; }
  catch { return {}; }
}

function writeFallbackCache(cache: Record<string, unknown>) {
  if (!hasBrowserStorage()) return;
  localStorage.setItem(FALLBACK_CACHE, JSON.stringify(cache));
}

export function createClientMutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ops-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function saveOpsCache(key: string, value: unknown) {
  const db = await openDatabase();
  if (!db) {
    const cache = fallbackCache();
    cache[key] = { value, savedAt: new Date().toISOString() };
    writeFallbackCache(cache);
    return;
  }
  try {
    const transaction = db.transaction("cache", "readwrite");
    await requestResult(transaction.objectStore("cache").put({ key, value, savedAt: new Date().toISOString() }));
  } finally { db.close(); }
}

export async function loadOpsCache<T>(key: string): Promise<{ value: T; savedAt: string } | null> {
  const db = await openDatabase();
  if (!db) return (fallbackCache()[key] as { value: T; savedAt: string } | undefined) || null;
  try {
    const transaction = db.transaction("cache", "readonly");
    return await requestResult(transaction.objectStore("cache").get(key)) as { value: T; savedAt: string } | undefined || null;
  } finally { db.close(); }
}

export async function clearOpsCache() {
  const db = await openDatabase();
  if (!db) {
    if (hasBrowserStorage()) localStorage.removeItem(FALLBACK_CACHE);
    return;
  }
  try {
    const transaction = db.transaction("cache", "readwrite");
    await requestResult(transaction.objectStore("cache").clear());
  } finally { db.close(); }
}

export async function queueOfflineEntry(payload: Record<string, unknown>) {
  const clientMutationId = String(payload.clientMutationId || createClientMutationId());
  const item: OfflineEntryMutation = {
    clientMutationId,
    createdAt: String(payload.offlineOccurredAt || new Date().toISOString()),
    status: "pending",
    attempts: 0,
    lastError: "",
    payload: { ...payload, clientMutationId },
  };
  const db = await openDatabase();
  if (!db) {
    const items = fallbackOutbox().filter((row) => row.clientMutationId !== clientMutationId);
    items.push(item);
    writeFallbackOutbox(items);
    return item;
  }
  try {
    const transaction = db.transaction("outbox", "readwrite");
    await requestResult(transaction.objectStore("outbox").put(item));
    return item;
  } finally { db.close(); }
}

export async function listOfflineEntries() {
  const db = await openDatabase();
  if (!db) return fallbackOutbox().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  try {
    const transaction = db.transaction("outbox", "readonly");
    const rows = await requestResult(transaction.objectStore("outbox").getAll()) as OfflineEntryMutation[];
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally { db.close(); }
}

export async function updateOfflineEntry(clientMutationId: string, updates: Partial<OfflineEntryMutation>) {
  const items = await listOfflineEntries();
  const current = items.find((row) => row.clientMutationId === clientMutationId);
  if (!current) return null;
  const next = { ...current, ...updates, clientMutationId };
  const db = await openDatabase();
  if (!db) {
    writeFallbackOutbox(items.map((row) => row.clientMutationId === clientMutationId ? next : row));
    return next;
  }
  try {
    const transaction = db.transaction("outbox", "readwrite");
    await requestResult(transaction.objectStore("outbox").put(next));
    return next;
  } finally { db.close(); }
}

export async function removeOfflineEntry(clientMutationId: string) {
  const db = await openDatabase();
  if (!db) {
    writeFallbackOutbox(fallbackOutbox().filter((row) => row.clientMutationId !== clientMutationId));
    return;
  }
  try {
    const transaction = db.transaction("outbox", "readwrite");
    await requestResult(transaction.objectStore("outbox").delete(clientMutationId));
  } finally { db.close(); }
}
