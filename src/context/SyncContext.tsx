'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, memo } from 'react';
import { getPendingQueue, updateQueueItemStatus, removeQueueItem, getQueueCount } from '@/lib/db';
import toast from 'react-hot-toast';

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  syncInProgress: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  pendingCount: 0,
  syncInProgress: false,
  triggerSync: async () => { },
});

export const useSync = () => useContext(SyncContext);

// Isolate children from SyncProvider re-renders caused by sync polling.
// React.memo prevents children from re-rendering when SyncProvider's own
// state (isOnline, pendingCount, syncInProgress) changes — only consumers
// of useSync() will re-render.
const SyncChildren = memo(({ children }: { children: React.ReactNode }) => <>{children}</>);
SyncChildren.displayName = 'SyncChildren';

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const syncInProgressRef = useRef(false);

  const checkQueueCount = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || syncInProgressRef.current) return;

    try {
      syncInProgressRef.current = true;
      setSyncInProgress(true);
      const pendingItems = await getPendingQueue();

      if (pendingItems.length === 0) {
        syncInProgressRef.current = false;
        setSyncInProgress(false);
        return;
      }

      toast.loading(`Syncing ${pendingItems.length} records...`, { id: 'sync-status' });

      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        try {
          await updateQueueItemStatus(item.id, 'syncing');

          const res = await fetch(item.payload.endpoint || '/api/generate-handover', {
            method: item.payload.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload.body || item.payload),
          });

          if (!res.ok) {
            if (res.status >= 400 && res.status < 500) {
              console.error(`Unrecoverable sync failure (status ${res.status}) for item ${item.id}. Removing from queue.`);
              await removeQueueItem(item.id);
              failCount++;
              continue;
            }
            throw new Error(`API Sync Failed with status ${res.status}`);
          }

          await removeQueueItem(item.id);
          successCount++;
        } catch (err) {
          console.error(`Failed to sync item ${item.id}`, err);
          await updateQueueItemStatus(item.id, 'failed', true);
          failCount++;
        }
      }

      await checkQueueCount();

      if (failCount === 0) {
        toast.success(`Successfully synced ${successCount} records.`, { id: 'sync-status' });
      } else {
        toast.error(`Sync completed with ${failCount} errors. Will retry automatically.`, { id: 'sync-status' });
      }

    } finally {
      syncInProgressRef.current = false;
      setSyncInProgress(false);
    }
  }, [checkQueueCount]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        toast.success('Connection restored. Syncing...', { id: 'network-status' });
        triggerSync();
      };

      const handleOffline = () => {
        setIsOnline(false);
        toast.error('Offline mode enabled. Drafts will be saved locally.', { id: 'network-status', duration: 4000 });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      checkQueueCount();
      triggerSync();

      const interval = setInterval(() => {
        checkQueueCount();
        triggerSync();
      }, 15000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        clearInterval(interval);
      };
    }
  }, [checkQueueCount, triggerSync]);

  const contextValue = React.useMemo(
    () => ({ isOnline, pendingCount, syncInProgress, triggerSync }),
    [isOnline, pendingCount, syncInProgress, triggerSync]
  );

  return (
    <SyncContext.Provider value={contextValue}>
      <SyncChildren>{children}</SyncChildren>
    </SyncContext.Provider>
  );
};
