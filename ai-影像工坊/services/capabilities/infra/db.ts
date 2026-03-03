import { HistoryItem } from "../../../components/HistorySidebar";

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

const nowMs = () => Date.now();

const toText = (value: unknown, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
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
    ready: false,
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
    return items.sort((a, b) => b.timestamp - a.timestamp);
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
    return {
      id,
      timestamp: Number(source.timestamp || source.updatedAt || nowMs()),
      userInput: toText(source.userInput, ""),
      plan: source.plan && typeof source.plan === "object" ? source.plan : ({} as any),
    };
  }

  private mergeById(remote: HistoryItem[], local: HistoryItem[]): HistoryItem[] {
    const map = new Map<string, HistoryItem>();
    for (const item of remote) map.set(item.id, item);
    for (const item of local) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  private async checkCloudReady(): Promise<boolean> {
    const now = nowMs();
    if (now - this.cloudHealth.checkedAt < HEALTH_CACHE_TTL_MS) {
      return this.cloudHealth.ready;
    }
    this.cloudHealth.checkedAt = now;

    try {
      const data = await fetchJson(`${HISTORY_API}?action=health`);
      const ready = Boolean(data?.storage?.configured && data?.storage?.connected);
      this.cloudHealth.ready = ready;
      return ready;
    } catch {
      this.cloudHealth.ready = false;
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
    const data = await fetchJson(`${HISTORY_API}?action=list&limit=${limit}`);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((it: any) => this.normalizeRemoteItem(it)).filter(Boolean) as HistoryItem[];
  }

  private async cloudDelete(id: string): Promise<void> {
    await fetchJson(HISTORY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  async saveItem(item: HistoryItem): Promise<void> {
    const useCloud = await this.checkCloudReady();

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
    const useCloud = await this.checkCloudReady();
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
    const useCloud = await this.checkCloudReady();

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

