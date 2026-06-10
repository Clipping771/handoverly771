import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface HandoverDraft {
  resident_id: string;
  tasks: Array<{ id: string; tag: string; description: string }>;
  last_modified: number;
  sync_status: 'draft';
}

interface SubmissionQueueItem {
  id: string; // UUID
  resident_id: string;
  payload: any; // The formatted input or structured handover request
  created_at: number;
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed';
}

interface HandoverlyDB extends DBSchema {
  drafts: {
    key: string; // resident_id
    value: HandoverDraft;
  };
  submission_queue: {
    key: string; // id
    value: SubmissionQueueItem;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<HandoverlyDB>> | null = null;

export function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<HandoverlyDB>('handoverly-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'resident_id' });
        }
        if (!db.objectStoreNames.contains('submission_queue')) {
          const queueStore = db.createObjectStore('submission_queue', { keyPath: 'id' });
          queueStore.createIndex('by-status', 'status');
        }
      },
    });
  }
  return dbPromise;
}

// Robust IndexedDB transaction wrapper with automatic connection recovery
async function withDB<T>(operation: (db: IDBPDatabase<HandoverlyDB>) => Promise<T>): Promise<T | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    return await operation(db);
  } catch (err: any) {
    console.warn('IndexedDB operation failed. Resetting connection and retrying...', err);
    dbPromise = null; // Reset connection promise
    const retryDb = await getDB();
    if (!retryDb) return null;
    try {
      return await operation(retryDb);
    } catch (retryErr) {
      console.error('IndexedDB operation failed after reconnect:', retryErr);
      throw retryErr;
    }
  }
}

// Draft Operations
export async function saveDraft(resident_id: string, tasks: any[]) {
  await withDB(db => db.put('drafts', {
    resident_id,
    tasks,
    last_modified: Date.now(),
    sync_status: 'draft',
  }));
}

export async function getDraft(resident_id: string) {
  return withDB(db => db.get('drafts', resident_id));
}

export async function clearDraft(resident_id: string) {
  await withDB(db => db.delete('drafts', resident_id));
}

// Queue Operations
export async function addToQueue(item: Omit<SubmissionQueueItem, 'status' | 'retry_count' | 'created_at'>) {
  const fullItem: SubmissionQueueItem = {
    ...item,
    created_at: Date.now(),
    retry_count: 0,
    status: 'pending',
  };
  await withDB(db => db.put('submission_queue', fullItem));
  return fullItem;
}

export async function getPendingQueue() {
  const res = await withDB(async (db) => {
    const tx = db.transaction('submission_queue', 'readonly');
    const index = tx.store.index('by-status');
    const pending = await index.getAll('pending');
    const failed = await index.getAll('failed');
    return [...pending, ...failed].sort((a, b) => a.created_at - b.created_at);
  });
  return res || [];
}

export async function updateQueueItemStatus(id: string, status: SubmissionQueueItem['status'], incrementRetry = false) {
  await withDB(async (db) => {
    const item = await db.get('submission_queue', id);
    if (item) {
      item.status = status;
      if (incrementRetry) {
        item.retry_count += 1;
      }
      await db.put('submission_queue', item);
    }
  });
}

export async function removeQueueItem(id: string) {
  await withDB(db => db.delete('submission_queue', id));
}

export async function getQueueCount() {
  const items = await getPendingQueue();
  return items.length;
}
