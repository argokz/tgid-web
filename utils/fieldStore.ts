/**
 * Хранение полевого приложения на устройстве: очередь действий (с фото — Blob) в IndexedDB и последний
 * загруженный список нарядов, чтобы открыть его без связи. База — своя на город (storageKey: Алматы и Астана
 * живут на одном домене). Нет IndexedDB (приватный режим старого Safari) — очередь живёт до закрытия вкладки.
 */
import type { FieldAction } from './fieldQueue';
import type { WorkOrder } from './workOrders';
import { toRaw } from 'vue';
import { storageKey } from './appStorage';

const DB_VERSION = 1;
const QUEUE = 'queue';
const ORDERS = 'orders';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = { queue: new Map<string, FieldAction>(), orders: new Map<string, unknown>() };

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(storageKey('tgid-field'), DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(ORDERS)) db.createObjectStore(ORDERS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: транзакция прервана'));
  });
}

export const fieldStore = {
  /** true — очередь переживёт закрытие вкладки */
  async persistent(): Promise<boolean> {
    return (await openDb()) !== null;
  },

  async listActions(): Promise<FieldAction[]> {
    const db = await openDb();
    const items = db ? await run<FieldAction[]>(db, QUEUE, 'readonly', (s) => s.getAll()) : [...memory.queue.values()];
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async putAction(action: FieldAction): Promise<void> {
    const db = await openDb();
    // toRaw: действие могло прийти из реактивного списка страницы
    if (db) await run(db, QUEUE, 'readwrite', (s) => s.put({ ...toRaw(action) }));
    else memory.queue.set(action.id, action);
  },

  async deleteAction(id: string): Promise<void> {
    const db = await openDb();
    if (db) await run(db, QUEUE, 'readwrite', (s) => s.delete(id));
    else memory.queue.delete(id);
  },

  /** Последний список нарядов бригады и открытые карточки — для работы без связи */
  async saveOrders(key: string, orders: WorkOrder[]): Promise<void> {
    // копия без реактивных прокси Vue: IndexedDB их не клонирует; наряды — чистый JSON из API
    const plain = JSON.parse(JSON.stringify(orders)) as WorkOrder[];
    const db = await openDb();
    if (db) await run(db, ORDERS, 'readwrite', (s) => s.put(plain, key));
    else memory.orders.set(key, plain);
  },

  /** При выходе: списки нарядов не остаются на чужом телефоне */
  async clearOrders(): Promise<void> {
    const db = await openDb();
    if (db) await run(db, ORDERS, 'readwrite', (s) => s.clear());
    else memory.orders.clear();
  },

  async loadOrders(key: string): Promise<WorkOrder[] | null> {
    const db = await openDb();
    const value = db ? await run<unknown>(db, ORDERS, 'readonly', (s) => s.get(key)) : memory.orders.get(key);
    return Array.isArray(value) ? (value as WorkOrder[]) : null;
  },
};
