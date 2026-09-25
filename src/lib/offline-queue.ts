"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * Durable queue for field mutations recorded without connectivity. Only idempotent-safe JSON
 * requests (checklist, GPS, measurements) are queued; each keeps its original capture time.
 * Evidence photos and the legal result always require a live connection.
 */
export type QueuedRequest = {
  id: string;
  url: string;
  method: "POST" | "PATCH";
  body: unknown;
  label: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB = "lm-field-offline";
const STORE = "queue";
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB(DB, 2, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
    },
  });
  return dbp;
}

export async function enqueue(req: Omit<QueuedRequest, "id" | "createdAt" | "attempts">) {
  const item: QueuedRequest = { ...req, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 };
  await (await db()).put(STORE, item);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
  return item;
}

export async function listQueue(): Promise<QueuedRequest[]> {
  const all = (await (await db()).getAll(STORE)) as QueuedRequest[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Replays queued requests in capture order. Stops at the first network failure; 4xx responses are dropped with the error kept for review. */
export async function flushQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  const d = await db();
  let synced = 0;
  let failed = 0;
  for (const item of await listQueue()) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json", "X-Offline-Captured-At": new Date(item.createdAt).toISOString() },
        body: JSON.stringify(item.body),
        credentials: "same-origin",
      });
      if (res.ok) {
        await d.delete(STORE, item.id);
        synced++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        await d.put(STORE, { ...item, attempts: item.attempts + 1, lastError: `HTTP ${res.status}` });
        failed++;
        if (item.attempts + 1 >= 3) await d.delete(STORE, item.id);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
  return { synced, failed, remaining: (await listQueue()).length };
}
