'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  triggerSync: async () => {},
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const checkQueueCount = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || syncInProgress) return;

    try {
      setSyncInProgress(true);
      const pendingItems = await getPendingQueue();
      
      if (pendingItems.length === 0) {
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

          if (!res.ok) throw new Error('API Sync Failed');

          // If successful, remove from queue
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
      setSyncInProgress(false);
    }
  }, [syncInProgress, checkQueueCount]);

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

      // Initial check and trigger sync
      checkQueueCount();
      triggerSync();
      
      // Auto-sync interval
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

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, syncInProgress, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};
