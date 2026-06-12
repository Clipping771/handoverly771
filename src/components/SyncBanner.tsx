'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSync } from '@/context/SyncContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SyncBanner() {
  const { isOnline, pendingCount, syncInProgress } = useSync();
  const [showSynced, setShowSynced] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const prevSyncInProgress = useRef(syncInProgress);
  const prevPendingCount = useRef(pendingCount);

  useEffect(() => {
    // Transition from syncing=true to false with pendingCount=0 means successful sync completion
    if (prevSyncInProgress.current && !syncInProgress && pendingCount === 0 && isOnline && prevPendingCount.current > 0) {
      setShowSynced(true);
      setHasError(false);
      const timer = setTimeout(() => {
        setShowSynced(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    // If sync finished but there are still pending records, sync failed or is retrying
    if (prevSyncInProgress.current && !syncInProgress && pendingCount > 0 && isOnline) {
      setHasError(true);
    }

    // Reset error when sync starts again
    if (syncInProgress) {
      setHasError(false);
    }

    prevSyncInProgress.current = syncInProgress;
    prevPendingCount.current = pendingCount;
  }, [syncInProgress, pendingCount, isOnline]);

  const showOffline = !isOnline;
  const showSyncing = isOnline && syncInProgress;
  const showError = isOnline && hasError && pendingCount > 0;
  
  const isVisible = showOffline || showSyncing || showError || showSynced;

  if (!isVisible) return null;

  let borderStyles = 'border-amber-500/30';
  let bgStyles = 'bg-amber-500/20';
  let textColor = 'text-amber-700 dark:text-amber-400';
  let Icon = WifiOff;
  let message = '';

  if (showOffline) {
    borderStyles = 'border-amber-500/30';
    bgStyles = 'bg-amber-500/25';
    textColor = 'text-amber-700 dark:text-amber-400';
    Icon = WifiOff;
    message = `Offline · ${pendingCount} changes pending`;
  } else if (showSyncing) {
    borderStyles = 'border-indigo-500/30';
    bgStyles = 'bg-indigo-500/25';
    textColor = 'text-indigo-700 dark:text-indigo-400';
    Icon = RefreshCw;
    message = `Syncing ${pendingCount} changes...`;
  } else if (showError) {
    borderStyles = 'border-rose-500/30';
    bgStyles = 'bg-rose-500/25';
    textColor = 'text-rose-700 dark:text-rose-400';
    Icon = AlertTriangle;
    message = 'Sync failed · will retry';
  } else if (showSynced) {
    borderStyles = 'border-emerald-500/30';
    bgStyles = 'bg-emerald-500/25';
    textColor = 'text-emerald-700 dark:text-emerald-450';
    Icon = CheckCircle2;
    message = 'Synced successfully';
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -70, x: '-50%', opacity: 0 }}
        animate={{ y: 0, x: '-50%', opacity: 1 }}
        exit={{ y: -70, x: '-50%', opacity: 0 }}
        className={`fixed top-4 left-1/2 z-50 ${bgStyles} ${textColor} border ${borderStyles} backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold shadow-lg shadow-black/5`}
      >
        <Icon className={`w-3.5 h-3.5 ${showSyncing ? 'animate-spin' : ''}`} />
        <span className="font-sans tracking-wide">{message}</span>
      </motion.div>
    </AnimatePresence>
  );
}
