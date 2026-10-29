/**
 * Хранение полевого приложения на устройстве: очередь действий (с фото — Blob) в IndexedDB и последний
 * загруженный список нарядов, чтобы открыть его без связи. База — своя на город (storageKey: Алматы и Астана
 * живут на одном домене). Нет IndexedDB (приватный режим старого Safari) — очередь живёт до закрытия вкладки.
 */
import type { FieldNetwork } from './fieldNetwork';
import type { FieldAction } from './fieldQueue';
import type { WorkOrder } from './workOrders';
import { toRaw } from 'vue';
import { storageKey } from './appStorage';

// 2 — сеть вокруг нарядов (шаг 2: карта места работ без связи)
const DB_VERSION = 2;
const QUEUE = 'queue';
const ORDERS = 'orders';
const NETWORK = 'network';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = {
  queue: new Map<string, FieldAction>(),
  orders: new Map<string, unknown>(),
  network: new Map<number, FieldNetwork>(),
};

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
        if (!db.objectStoreNames.contains(NETWORK)) db.createObjectStore(NETWORK, { keyPath: 'orderId' });
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

  /** При выходе: списки нарядов и сеть вокруг них не остаются на чужом телефоне */
  async clearOrders(): Promise<void> {
    const db = await openDb();
    if (db) {
      await run(db, ORDERS, 'readwrite', (s) => s.clear());
      await run(db, NETWORK, 'readwrite', (s) => s.clear());
    } else {
      memory.orders.clear();
      memory.network.clear();
    }
  },

  async saveNetwork(net: FieldNetwork): Promise<void> {
    const plain = JSON.parse(JSON.stringify(net)) as FieldNetwork;
    const db = await openDb();
    if (db) await run(db, NETWORK, 'readwrite', (s) => s.put(plain));
    else memory.network.set(plain.orderId, plain);
  },

  async loadNetwork(orderId: number): Promise<FieldNetwork | null> {
    const db = await openDb();
    const value = db ? await run<FieldNetwork | undefined>(db, NETWORK, 'readonly', (s) => s.get(orderId))
      : memory.network.get(orderId);
    return value ?? null;
  },

  /** Сеть закрытых нарядов больше не нужна — не копить на телефоне */
  async pruneNetwork(keepOrderIds: number[]): Promise<void> {
    const keep = new Set(keepOrderIds);
    const db = await openDb();
    if (!db) {
      [...memory.network.keys()].filter((id) => !keep.has(id)).forEach((id) => memory.network.delete(id));
      return;
    }
    const ids = await run<IDBValidKey[]>(db, NETWORK, 'readonly', (s) => s.getAllKeys());
    for (const id of ids) {
      if (!keep.has(Number(id))) await run(db, NETWORK, 'readwrite', (s) => s.delete(id));
    }
  },

  async loadOrders(key: string): Promise<WorkOrder[] | null> {
    const db = await openDb();
    const value = db ? await run<unknown>(db, ORDERS, 'readonly', (s) => s.get(key)) : memory.orders.get(key);
    return Array.isArray(value) ? (value as WorkOrder[]) : null;
  },
};
