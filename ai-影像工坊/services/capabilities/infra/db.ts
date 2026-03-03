import { HistoryItem } from "../../../components/HistorySidebar";
import { GatewayClient } from "../../api/client";

// ==========================================
// 持久化存储层 (Cloud-first History Persistence)
// 职责:
// 1. 优先读写后端 /api/history（全站共享历史）
// 2. 后端不可用时回退本地 IndexedDB
// ==========================================

const DB_NAME = "AIStudio_DB";
const DB_VERSION = 1;
const STORE_NAME = "shoot_history";

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
const HISTORY_API = `${API_BASE}/api/history`;
const HEALTH_CACHE_TTL_MS = 15_000;
const CLOUD_PAGE_LIMIT = 200;
const CLOUD_MAX_PAGES = 20;

const nowMs = () => Date.now();
const historySortValue = (item: HistoryItem) => Number(item?.updatedAt || item?.timestamp || 0);
const validTimestamp = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toText = (value: unknown, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const withGatewayHeaders = (headers?: HeadersInit): Record<string, string> => {
  const output: Record<string, string> = {};
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    for (const [key, value] of Object.entries(headers as Record<string, string>)) {
      output[key] = value;
    }
  }

  const token = String(GatewayClient.getApiKey() || "").trim();
  if (token) {
    output["x-gateway-token"] = token;
    output.Authorization = `Bearer ${token}`;
  }
  return output;
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...(init || {}),
    headers: withGatewayHeaders(init?.headers),
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: text || "响应解析失败" };
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
};

export class PersistenceService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cloudHealth = {
    checkedAt: 0,
    readable: false,
    writable: false,
  };

  constructor() {
    if (typeof window !== "undefined" && "indexedDB" in window) {
      this.dbPromise = this.initIndexedDB();
    }
  }

  private initIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB Error:", event);
        reject(new Error("Failed to open database"));
      };
    });
  }

  private async localSave(item: HistoryItem): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async localGetAll(): Promise<HistoryItem[]> {
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    const items = await new Promise<HistoryItem[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as HistoryItem[]);
      request.onerror = () => reject(request.error);
    });
    return items.sort((a, b) => historySortValue(b) - historySortValue(a));
  }

  private async localDelete(id: string): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private normalizeRemoteItem(source: any): HistoryItem | null {
    if (!source || typeof source !== "object") return null;
    const id = toText(source.id, "");
    if (!id) return null;
    const timestamp = validTimestamp(source.timestamp || source.updatedAt, nowMs());
    const updatedAt = validTimestamp(source.updatedAt || source.timestamp, timestamp);
    return {
      id,
      timestamp,
      updatedAt,
      createdAtIso: toText(source.createdAtIso, new Date(timestamp).toISOString()),
      updatedAtIso: toText(source.updatedAtIso, new Date(updatedAt).toISOString()),
      clientIp: toText(source.clientIp, "unknown"),
      source: toText(source.source, "vercel_blob"),
      taskStatus: toText(source.taskStatus, "completed") as HistoryItem["taskStatus"],
      userInput: toText(source.userInput, ""),
      plan: source.plan && typeof source.plan === "object" ? source.plan : ({} as any),
    };
  }

  private mergeById(remote: HistoryItem[], local: HistoryItem[]): HistoryItem[] {
    const map = new Map<string, HistoryItem>();
    for (const item of remote) map.set(item.id, item);
    for (const item of local) {
      const current = map.get(item.id);
      if (!current) {
        map.set(item.id, item);
        continue;
      }
      map.set(item.id, historySortValue(item) > historySortValue(current) ? item : current);
    }
    return [...map.values()].sort((a, b) => historySortValue(b) - historySortValue(a));
  }

  private async checkCloudReady(mode: "read" | "write" = "read"): Promise<boolean> {
    const now = nowMs();
    if (now - this.cloudHealth.checkedAt < HEALTH_CACHE_TTL_MS) {
      return mode === "write" ? this.cloudHealth.writable : this.cloudHealth.readable;
    }
    this.cloudHealth.checkedAt = now;

    try {
      const data = await fetchJson(`${HISTORY_API}?action=health`);
      const storageReady = Boolean(data?.storage?.configured && data?.storage?.connected);
      const runtimeEnabled = data?.runtime?.enabled !== false;
      const readOnly = Boolean(data?.runtime?.readOnly);
      const readable = storageReady && runtimeEnabled;
      const writable = readable && !readOnly;
      this.cloudHealth.readable = readable;
      this.cloudHealth.writable = writable;
      return mode === "write" ? writable : readable;
    } catch {
      this.cloudHealth.readable = false;
      this.cloudHealth.writable = false;
      return false;
    }
  }

  private async cloudUpsert(item: HistoryItem): Promise<HistoryItem> {
    const data = await fetchJson(HISTORY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", item }),
    });
    const normalized = this.normalizeRemoteItem(data?.item);
    if (!normalized) throw new Error("云端历史返回格式无效");
    return normalized;
  }

  private async cloudList(limit = 120): Promise<HistoryItem[]> {
    const perPage = Math.max(1, Math.min(Math.floor(limit), CLOUD_PAGE_LIMIT));
    const merged: HistoryItem[] = [];
    let cursor = "";
    let page = 0;

    while (page < CLOUD_MAX_PAGES) {
      const url = `${HISTORY_API}?action=list&limit=${perPage}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const data = await fetchJson(url);
      const rows = Array.isArray(data?.items) ? data.items : [];
      const normalized = rows.map((it: any) => this.normalizeRemoteItem(it)).filter(Boolean) as HistoryItem[];
      merged.push(...normalized);

      const hasMore = Boolean(data?.hasMore);
      const nextCursor = toText(data?.cursor, "");
      if (!hasMore || !nextCursor || nextCursor === cursor) break;

      cursor = nextCursor;
      page += 1;
    }

    return merged.sort((a, b) => historySortValue(b) - historySortValue(a));
  }

  private async cloudDelete(id: string): Promise<void> {
    await fetchJson(HISTORY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  async saveItem(item: HistoryItem): Promise<void> {
    const useCloud = await this.checkCloudReady("write");

    if (useCloud) {
      try {
        const saved = await this.cloudUpsert(item);
        await this.localSave(saved);
        return;
      } catch (error) {
        console.warn("History cloud save failed, fallback local:", error);
      }
    }

    await this.localSave(item);
  }

  async getAllItems(): Promise<HistoryItem[]> {
    const useCloud = await this.checkCloudReady("read");
    const local = await this.localGetAll();

    if (useCloud) {
      try {
        const remote = await this.cloudList();
        for (const item of remote.slice(0, 60)) {
          this.localSave(item).catch(() => undefined);
        }
        return this.mergeById(remote, local);
      } catch (error) {
        console.warn("History cloud list failed, fallback local:", error);
      }
    }

    return local;
  }

  async deleteItem(id: string): Promise<void> {
    const useCloud = await this.checkCloudReady("write");

    if (useCloud) {
      try {
        await this.cloudDelete(id);
      } catch (error) {
        console.warn("History cloud delete failed, fallback local:", error);
      }
    }

    await this.localDelete(id);
  }

  async estimateUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      console.log(`Storage: ${(usage! / 1024 / 1024).toFixed(2)}MB used / ${(quota! / 1024 / 1024).toFixed(2)}MB quota`);
    }
  }
}

export const dbService = new PersistenceService();
