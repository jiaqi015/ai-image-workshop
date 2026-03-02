
import { HistoryItem } from "../../../components/HistorySidebar";

// ==========================================
// 持久化存储层 (Persistence Layer - IndexedDB)
// 职责: 处理大容量数据存储 (Base64 图片)，避开 LocalStorage 5MB 限制
// ==========================================

const DB_NAME = 'AIStudio_DB';
const DB_VERSION = 1;
const STORE_NAME = 'shoot_history';

export class PersistenceService {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined') return;
            
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // 创建存储库，以 id 为主键
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                console.error("IndexedDB Error:", event);
                reject("Failed to open database");
            };
        });
    }

    // 保存单条记录
    async saveItem(item: HistoryItem): Promise<void> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(item); // put = insert or update

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 获取所有记录 (按时间倒序)
    async getAllItems(): Promise<HistoryItem[]> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result as HistoryItem[];
                // 内存排序，IndexedDB 默认按 Key 排序，这里手动按 timestamp 倒序
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 删除记录
    async deleteItem(id: string): Promise<void> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // 检查配额 (仅供调试)
    async estimateUsage() {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            console.log(`Storage: ${(usage! / 1024 / 1024).toFixed(2)}MB used / ${(quota! / 1024 / 1024).toFixed(2)}MB quota`);
        }
    }
}

export const dbService = new PersistenceService();
